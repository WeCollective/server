'use strict';

const aws = require('../../config/aws');
const Branch = require('../../models/branch.model');
const Comment = require('../../models/comment');
const CommentData = require('../../models/comment-data.model');
const error = require('../../responses/errors');
const FlaggedPost = require('../../models/flagged-post.model');
const fs = require('../../config/filestorage');
const mailer = require('../../config/mailer');
const Mod = require('../../models/mod.model');
const Notification = require('../../models/notification.model');
const NotificationTypes = require('../../config/notification-types');
const Post = require('../../models/post.model');
const PostData = require('../../models/post-data.model');
const PostImage = require('../../models/post-image.model');
const success = require('../../responses/successes');
const Tag = require('../../models/tag.model');
const User = require('../../models/user.model');
const Vote = require('../../models/user-vote.model');

const post = {
  verifyParams(req) {
    if (!req.user.username) {
      console.error('No username found in session.');
      return Promise.reject({ code: 500 });
    }

    if (!req.body.title || req.body.title.length === 0) {
      return Promise.reject({
        code: 400,
        message: 'Invalid title.',
      });
    }
    else if (req.body.title.length > 200) {
      return Promise.reject({
        code: 400,
        message: 'Title cannot be more than 200 characters long.',
      });
    }

    try {
      req.body.branchids = JSON.parse(req.body.branchids);
    }
    catch (err) {
      return Promise.reject({
        code: 400,
        message: 'Malformed branchids.',
      });
    }

    if (!req.body.branchids) {
      return Promise.reject({
        code: 400,
        message: 'Invalid branchids.',
      });
    }
    else if (req.body.branchids.length === 0) {
      req.body.branchids.push('root');
    }
    else if (req.body.branchids.length > 5) {
      return Promise.reject({
        code: 400,
        message: 'Max 5 tags allowed.',
      });
    }

    return Promise.resolve(req);
  },
};

const voteComment = {
  verifyParams(req) {
    if (!req.params.postid) {
      return Promise.reject({
        code: 400,
        message: 'Missing postid',
      });
    }

    if (!req.params.commentid) {
      return Promise.reject({
        code: 400,
        message: 'Missing commentid',
      });
    }

    if (!req.user.username) {
      console.error('No username found in session.');
      return Promise.reject({ code: 500 });
    }

    if (!req.body.vote || (req.body.vote !== 'up' && req.body.vote !== 'down')) {
      return Promise.reject({
        code: 400,
        message: 'Missing or malformed vote parameter.',
      });
    }

    return Promise.resolve(req);
  },
};

module.exports.delete = (req, res) => {
  const postid = req.params.postid;

  if (!req.user || !req.user.username) {
    return error.Forbidden(res);
  }

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  const branchesToUpdate = [];

  let postComments = null;
  let postGlobalPoints = null;

  // Delete all post entries on all branches where it was included.
  // NB: Do not remove post data and post images for now - may want to reinstate posts.
  new Post()
    .findById(postid)
    .then(posts => {
      const promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        const branchid = post.branchid;

        branchesToUpdate.push(branchid);

        if (postComments === null) {
          postComments = post.comment_count;
        }

        if (postGlobalPoints === null) {
          postGlobalPoints = post.global;
        }

        promises.push(new Post().delete({
          branchid,
          id: post.id,
        }));
      }

      return Promise.all(promises);
    })
    // Delete all flagged post instances.
    .then(() => new FlaggedPost().findById(postid))
    .then(posts => {
      const promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        promises.push(new FlaggedPost().delete({
          branchid: post.branchid,
          id: post.id,
        }));
      }

      return Promise.all(promises);
    })
    // Update branch stats.
    .then(() => {
      const promises = [];

      for (let i = 0; i < branchesToUpdate.length; i += 1) {
        const branchid = branchesToUpdate[i];
        promises.push(new Promise((resolve, reject) => {
          const branch = new Branch();
          return branch
            .findById(branchid)
            .then(() => resolve(branch))
            .catch(err => reject(err));
        }));
      }

      return Promise.all(promises);
    })
    .then(branches => {
      const promises = [];

      for (let i = 0; i < branches.length; i += 1) {
        const branch = branches[i];
        promises.push(new Promise((resolve, reject) => {
          branch.set('post_count', branch.data.post_count - 1);
          branch.set('post_comments', branch.data.post_comments - postComments);
          branch.set('post_points', branch.data.post_points - postGlobalPoints);
          return branch.update()
            .then(() => resolve())
            .then(err => reject(err));
        }));
      }

      return Promise.all(promises);
    })
    .then(() => success.OK(res))
    .catch(err => {
      if (err) {
        console.error('Error deleting posts: ', err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
};

module.exports.deleteComment = (req, res) => {
  const commentid = req.params.commentid;
  const parentComment = new Comment();
  const postid = req.params.postid;
  const user = new User();
  let comment;

  if (!commentid) {
    return error.BadRequest(res, 'Missing commentid');
  }

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  return module.exports.getOneComment(commentid, req)
    .then(foundComment => {
      comment = foundComment;

      if (comment.data.creator !== req.user.username) {
        return Promise.reject({
          code: 403,
          message: `You cannot delete other user's comments!`,
        });
      }

      const commentdata = new CommentData({ id: comment.id });

      if (comment.replies === 0) {
        return commentdata
          .delete()
          .then(() => new Comment().delete({ id: comment.id }))
          .catch(err => Promise.reject(err));
      }

      // Removing the comment would cut off the replies, we don't want that.
      commentdata.set('creator', 'N/A');
      commentdata.set('text', '[Comment removed by user]');
      return commentdata.update();
    })
    // Update counters.
    // Decrease total user comments.
    .then(() => user.findByUsername(req.user.username))
    .then(() => {
      user.set('num_comments', user.data.num_comments - 1);
      return user.update();
    })
    // Find all post entries where the comment appears and decrease their comment count.
    .then(() => new Post().findById(postid))
    .then(posts => {
      const promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const post = new Post(posts[i]);
        post.set('comment_count', posts[i].comment_count - 1);
        promises.push(post.update());
      }

      return Promise.all(promises);
    })
    .then(() => {
      if (comment.parentid === 'none') {
        return Promise.resolve();
      }

      return parentComment.findById(comment.parentid);
    })
    // Decrease the parent comment replies counter if a parent comment exists.
    .then(() => {
      if (comment.parentid === 'none') {
        return Promise.resolve();
      }

      parentComment.set('replies', parentComment.data.replies - 1);
      return parentComment.update();
    })
    // Find all post entries to get the list of branches it is tagged to.
    .then(() => new Post().findById(postid))
    // Decrease post comments totals for each branch.
    .then(posts => {
      const promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        promises.push(new Promise((resolve, reject) => {
          const branch = new Branch();
          return branch
            .findById(posts[i].branchid)
            .then(() => {
              branch.set('post_comments', branch.data.post_comments - 1);
              return branch.update();
            })
            .then(resolve)
            .catch(reject);
        }));
      }

      return Promise.all(promises);
    })
    .then(() => success.OK(res))
    .catch(err => {
      if (err) {
        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.get = (req, res) => {
  const postid = req.params.postid;

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  return module.exports.getOnePost(postid, req)
    .then(post => success.OK(res, post))
    .catch(err => {
      if (err) {
        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.getComment = (req, res) => {
  const commentId = req.params.commentid;
  const postId = req.params.postid;

  if (!postId) {
    return error.BadRequest(res, 'Missing postid');
  }

  if (!commentId) {
    return error.BadRequest(res, 'Missing commentid');
  }

  return module.exports.getOneComment(commentId, req)
    .then(comment => success.OK(res, comment.data))
    .catch(err => {
      if (err) {
        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.getComments = (req, res) => {
  const postId = req.params.postid;
  let parentId = req.query.parentid;
  let sortBy = req.query.sort;

  if (!postId) {
    return error.BadRequest(res, 'Missing postid');
  }

  // Get root comments by default.
  if (!parentId) {
    parentId = 'none';
  }

  // Order comments by points by default.
  if (!sortBy) {
    sortBy = 'points';
  }

  let comments = [];
  let hasMoreComments = false;
  let lastComment = null;

  new Promise((resolve, reject) => {
    // Client wants only results that appear after this comment (pagination).
    if (req.query.lastCommentId) {
      const comment = new Comment();

      return comment
        .findById(req.query.lastCommentId)
        .then(() => {
          // create lastComment object
          lastComment = comment.data;
          return resolve();
        })
        .catch(err => {
          if (err) {
            return reject();
          }

          // Invalid lastCommentId.
          return Promise.reject({ code: 404 });
        });
    }
    else {
      // No last comment specified, continue...
      return resolve();
    }
  })
    .then(() => new Comment().findByParent(postId, parentId, sortBy, lastComment))
    .then(foundComments => {
      comments = foundComments.comments;
      hasMoreComments = foundComments.hasMoreComments;

      const promises = [];

      comments.forEach((comment, index) => {
        promises.push(new Promise((resolve, reject) => {
          self
            .getOneComment(comment.id, req)
            .then(comment => {
              comments[index] = comment;
              return resolve();
            })
            .catch(reject);
        }));
      });

      return Promise.all(promises);
    })
    .then(() => success.OK(res, { comments, hasMoreComments }))
    .catch(err => {
      if (err) {
        console.error('Error fetching comments:', err);

        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

// todo Check the specfied comment actually belongs to this post.
module.exports.getOneComment = (id, req) => {
  let comment;

  return new Promise((resolve, reject) => {
    new Promise((resolve, reject) => {
      return resolve(new Comment().findById(id));
    })
      .then(newComment => {
        comment = newComment;

        return new CommentData()
          .findById(id)
          .then(data => {
            comment.data = data;
            return Promise.resolve();
          })
          .catch(reject);
      })
      // Extend the comment with information about user vote.
      .then(() => {
        if (req && req.user && req.user.username) {
          return new Promise((resolve, reject) => {
            new Vote()
              .findByUsernameAndItemId(req.user.username, `comment-${id}`)
              .then(existingVoteData => {
                if (existingVoteData) {
                  comment.votes.userVoted = existingVoteData.direction;
                }

                return resolve();
              })
              .catch(reject);
          });
        }

        return Promise.resolve();
      })
      .then(() => resolve(comment))
      .catch(err => {
        if (err) {
          console.error('Error fetching comment data:', err);
        }

        return reject(err);
      });
  });
};

module.exports.getOnePost = (id, req, branchid) => {
  let post;

  return new Promise((resolve, reject) => new Post().findById(id)
    .then(posts => {
      if (!posts || posts.length === 0) {
        return Promise.reject({ code: 404 });
      }

      let idx = 0;

      for (let i = 0; i < posts.length; i++) {
        const postBranchId = posts[i].branchid;
        // We can request which instance of the post we want.
        // By default, the root instance will be returned.
        if ((branchid && postBranchId === branchid) ||
          (!branchid && postBranchId === 'root')) {
          idx = i;
          break;
        }
      }

      post = posts[idx];

      return new PostData()
        .findById(id)
        .then(data => {
          post.data = data;
          return Promise.resolve();
        })
        .catch(reject);
    })
    // attach post image url to each post
    .then(() => Promise.resolve(new Promise(resolve => {
      module.exports.getPostPicture(id, false)
        .then(url => {
          post.profileUrl = url;
          return resolve();
        })
    })))
    // Attach post image thumbnail url to each post.
    .then(() => Promise.resolve(new Promise(resolve => {
      module.exports.getPostPicture(id, true)
        .then(url => {
          post.profileUrlThumb = url;
          return resolve();
        })
    })))
    // Extend the posts with information about user vote.
    .then(() => {
      if (req && req.user && req.user.username) {
        return new Promise((resolve, reject) => new Vote()
          .findByUsernameAndItemId(req.user.username, `post-${post.id}`)
          .then(existingVoteData => {
            if (existingVoteData) {
              post.votes.userVoted = existingVoteData.direction;
            }

            return resolve();
          })
          .catch(reject));
      }

      return Promise.resolve();
    })
    .then(() => resolve(post))
    .catch(err => {
      if (err) {
        console.error(`Error fetching post data: `, err);
      }

      return reject(err);
    }));
};

module.exports.getPostPicture = (postid, thumbnail = false) => {
  return new Promise(resolve => {
    if (!postid) return resolve('');

    const image = new PostImage();
    const size = thumbnail ? 200 : 640;

    image.findById(postid)
      .then(() => {
        const Bucket = fs.Bucket.PostImagesResized;
        const Key = `${image.data.id}-${size}.${image.data.extension}`;
        return resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}`);
      })
      .catch(err => {
        if (err) {
          console.error(`Error fetching post image:`, err);
          return resolve('');
        }

        return resolve('');
      });
  });
};

module.exports.post = (req, res) => {
  // fetch the tags of each specfied branch. The union of these is the list of
  // the branches the post should be tagged to.
  const branchidsArr = [];
  const date = new Date().getTime();
  const user = new User();

  const id = `${req.user.username}-${date}`;

  return post.verifyParams(req)
    .then(req => {
      const tagPromises = [];

      for (let i = 0; i < req.body.branchids.length; i += 1) {
        const branchid = req.body.branchids[i];
        tagPromises.push(new Tag()
          .findByBranch(branchid)
          .then(tags => {
            // All tags are collected, these are the branchids to tag the post to.
            for (let j = 0; j < tags.length; j += 1) {
              if (!branchidsArr.includes(tags[j].tag)) {
                branchidsArr.push(tags[j].tag);
              }
            }

            return Promise.resolve();
          })
          .catch(err => Promise.reject(err))
        );
      }

      return Promise.all(tagPromises);
    })
    // Validate the post data first, so this method doesn't fail halfway through.
    .then(() => {
      const newPostData = new PostData({
        creator: req.user.username,
        id,
        original_branches: JSON.stringify(req.body.branchids),
        text: req.body.text,
        title: req.body.title,
      });

      const invalids = newPostData.validate(undefined, req.body.type);
      if (invalids.length > 0) {
        return Promise.reject({
          code: 400,
          message: `Invalid ${invalids[0]}.`,
        });
      }

      return newPostData.save();
    })
    // Now create the branch ids.
    .then(() => {
      const promises = [];

      for (let i = 0; i < branchidsArr.length; i += 1) {
        const branchid = branchidsArr[i];

        const newPost = new Post({
          branchid,
          comment_count: 0,
          date,
          down: 0,
          global: 0,
          id,
          individual: 0,
          local: 0,
          locked: !!req.body.locked,
          nsfw: !!req.body.nsfw,
          type: req.body.type,
          up: 0,
        });

        const invalids = newPost.validate();
        if (invalids.length > 0) {
          return Promise.reject({
            code: 400,
            message: `Invalid ${invalids[0]}.`,
          });
        }

        promises.push(newPost.save());
      }

      return Promise.all(promises);
    })
    // Increment the post counters on the branch objects
    .then(() => {
      const promises = [];

      for (let i = 0; i < branchidsArr.length; i += 1) {
        promises.push(new Promise((resolve, reject) => {
          const branch = new Branch();

          branch
            .findById(branchidsArr[i])
            .then(() => {
              branch.set('post_count', branch.data.post_count + 1);
              return branch.update();
            })
            .then(resolve)
            .catch(reject);
        }));
      }

      return Promise.all(promises);
    })
    .then(() => user.findByUsername(req.user.username))
    .then(() => {
      // increment user's post count
      user.set('num_posts', user.data.num_posts + 1);
      return user.update();
    })
    // update the SendGrid contact list with the new user data
    .then(() => mailer.addContact(user.data, true))
    .then(() => success.OK(res, id))
    .catch(err => {
      if (err) {
        console.error('Error creating post:', err);

        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.BadRequest(res, 'Invalid branchid.');
    });
};

module.exports.postComment = (req, res) => {
  const parentid = req.body.parentid;
  const postid = req.params.postid;
  const username = req.user ? req.user.username : false;

  if (!username) {
    return error.Forbidden(res);
  }

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  const date = new Date().getTime();
  const id = `${username}-${date}`;
  const comment = new Comment({
    date,
    down: 0,
    id,
    individual: 0,
    parentid,
    postid,
    rank: 0,
    replies: 0,
    up: 0,
  });

  const commentdata = new CommentData({
    creator: username,
    date,
    edited: false,
    id,
    text: req.body.text,
  });

  let invalids = comment.validate();
  if (invalids.length > 0) {
    return error.BadRequest(res, `Invalid ${invalids[0]}`);
  }

  invalids = commentdata.validate();
  if (invalids.length > 0) {
    return error.BadRequest(res, `Invalid ${invalids[0]}`);
  }

  // ensure the specified post exists
  const parent = new Comment();
  const user = new User();
  // the post entries (one for each branch) this comment belongs to
  let commentPosts;

  return new Post()
    .findById(postid, 0)
    .then(posts => {
      if (!posts || posts.length === 0) {
        return Promise.reject();
      }

      commentPosts = posts;

      // if this is a root comment, continue
      if (parentid === 'none') {
        return Promise.resolve();
      }

      // otherwise, ensure the specified parent comment exists
      return parent.findById(parentid);
    })
    .then(() => {
      // Parent comment must belong to this post.
      if (parentid !== 'none' && parent.data.postid !== postid) {
        return Promise.reject({
          code: 400,
          message: 'Parent comment does not belong to the same post',
        });
      }

      return comment.save();
    })
    .then(() => commentdata.save())
    .then(() => {
      if (parentid === 'none') {
        return Promise.resolve();
      }

      parent.set('replies', parent.data.replies + 1);
      return parent.update();
    })
    .then(() => {
      // increment the number of comments on the post
      const promises = [];

      for (let i = 0; i < commentPosts.length; i += 1) {
        const post = new Post(commentPosts[i]);
        post.set('comment_count', commentPosts[i].comment_count + 1);
        promises.push(post.update());
      }

      return Promise.all(promises);
    })
    // find all post entries to get the list of branches it is tagged to
    .then(() => new Post().findById(postid))
    .then(posts => {
      // increment the post comments count on each branch object
      // the post appears in
      const promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        promises.push(new Promise(function(resolve, reject) {
          const branch = new Branch();
          return branch
            .findById(posts[i].branchid)
            .then(() => {
              branch.set('post_comments', branch.data.post_comments + 1);
              return branch.update();
            })
            .then(resolve)
            .catch(reject);
        }));
      }

      return Promise.all(promises);
    })
    // Notify the post or comment author that a comment has been posted
    // on their content. If the comment is a reply to someone, we will
    // notify the comment author. Otherwise, the comment is a root comment
    // and we will notify the post author.
    .then(() => new Post()
      .findById(postid)
      // Get the id of a branch where the post appears. Take the first branch
      // this post appears in (there are many) for the purposes of viewing the
      // notification. (todo WHY?)
      .then(posts => {
        const branchid = posts[0].branchid;
        const model = parentid === 'none' ? new PostData() : new CommentData();
        return model
          .findById(parentid === 'none' ? postid : parentid)
          .then(() => Promise.resolve({
            author: model.data.creator,
            branchid,
          }));
      })
      .catch(err => Promise.reject(err))
    )
    // Notify the author that their content has been interacted with.
    .then(data => {
      // Skip if interacting with our own content or if we are replying
      // to a deleted comment.
      if (username === data.author || (parentid !== 'none' && data.author === 'N/A')) {
        return Promise.resolve();
      }

      const notification = new Notification({
        data: {
          branchid: data.branchid,
          commentid: id,
          parentid,
          postid,
          username,
        },
        date,
        id: `${data.author}-${date}`,
        type: NotificationTypes.COMMENT,
        unread: true,
        user: data.author,
      });

      const invalids = notification.validate();
      if (invalids.length > 0) {
        console.error('Error creating notification. Invalids: ', invalids);
        return Promise.reject({
          code: 500,
          message: `Invalid ${invalids[0]}`,
        });
      }

      return notification.save();
    })
    .then(() => user.findByUsername(username))
    .then(() => {
      user.set('num_comments', user.data.num_comments + 1);
      return user.update();
    })
    // update the SendGrid contact list with the new user data
    .then(() => mailer.addContact(user.data, true))
    .then(() => success.OK(res, id))
    .catch(err => {
      if (err) {
        console.error('Error posting comment:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.voteComment = (req, res) => {
  const vote = new Vote();

  const commentId = req.params.commentid;
  const postId = req.params.postid;
  const username = req.user.username;

  let comment;
  let newVoteDirection;
  let newVoteOppositeDirection;
  let resData = { delta: 0 };
  let userAlreadyVoted = false;

  voteComment.verifyParams(req)
    .then(() => {
      comment = new Comment({
        id: commentId,
        postid: postId,
      });

      const propertiesToCheck = [
        'id',
        'postid',
      ];

      const invalids = comment.validate(propertiesToCheck);
      if (invalids.length > 0) {
        return Promise.reject({
          code: 400,
          message: `Invalid ${invalids[0]}`,
        });
      }

      newVoteDirection = req.body.vote;

      return comment.findById(commentId);
    })
    .then(() => new CommentData().findById(commentId))
    .then(commentData => {
      if (commentData.creator === 'N/A') {
        return Promise.reject({
          code: 403,
          message: 'You cannot vote on deleted comments!',
        });
      }

      return vote.findByUsernameAndItemId(username, `comment-${commentId}`);
    })
    .then(existingVoteData => {
      if (existingVoteData) {
        userAlreadyVoted = true;

        if (existingVoteData.direction !== newVoteDirection) {
          newVoteOppositeDirection = newVoteDirection === 'up' ? 'down' : 'up';
        }
      }

      return Promise.resolve();
    })
    // Update the comment 'up' and 'down' attributes.
    .then(() => {
      // Check the specfied comment actually belongs to this post.
      if (comment.data.postid !== postId) {
        return Promise.reject({ code: 404 });
      }

      let delta = 0;

      if (userAlreadyVoted) {
        // Undo the last vote and add the new vote.
        if (newVoteOppositeDirection) {
          comment.set(newVoteOppositeDirection, comment.data[newVoteOppositeDirection] - 1);
          comment.set(newVoteDirection, comment.data[newVoteDirection] + 1);
          delta = (newVoteOppositeDirection === 'up') ? 2 : -2;
        }
        // Undo the last vote.
        else {
          comment.set(newVoteDirection, comment.data[newVoteDirection] - 1);
          delta = (newVoteDirection === 'up') ? -1 : 1;
        }
      }
      else {
        comment.set(newVoteDirection, comment.data[newVoteDirection] + 1);
        delta = (newVoteDirection === 'up') ? 1 : -1;
      }

      resData.delta = delta;

      return comment.update();
    })
    // Create, update, or delete the vote record in the database.
    .then(() => {
      if (userAlreadyVoted) {
        if (newVoteOppositeDirection) {
          vote.set('direction', newVoteDirection);
          return vote.update();
        }

        return vote.delete();
      } 

      const newVote = new Vote({
        direction: newVoteDirection,
        itemid: `comment-${commentId}`,
        username,
      });

      const propertiesToCheck = [
        'itemid',
        'username',
      ];

      const invalids = newVote.validate(propertiesToCheck);

      if (invalids.length > 0) {
        console.error(`Error creating Vote: invalid ${invalids[0]}`);
        return Promise.reject({ code: 500 });
      }

      return newVote.save();
    })
    .then(() => success.OK(res, resData))
    .catch(err => {
      if (err) {
        console.error('Error updating comment:', err);

        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};






module.exports.getPictureUploadUrl = (req, res) => {
  if(!req.user || !req.user.username) {
    return error.Forbidden(res);
  }

  if(!req.params.postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  // ensure this user is the creator of the specified post
  var post = new PostData();
  post.findById(req.params.postid).then(function() {
    if(post.data.creator != req.user.username) {
      // user did not create this post
      return error.Forbidden(res);
    }

    var filename = req.params.postid + '-picture-orig.jpg';
    var params = {
      Bucket: fs.Bucket.PostImages,
      Key: filename,
      ContentType: 'image/*'
    }
    var url = aws.s3Client.getSignedUrl('putObject', params, function(err, url) {
      return success.OK(res, url);
    });
  }, function(err) {
    if(err) {
      console.error("Error fetching post data:", err);
      return error.InternalServerError(res);
    }
    return error.NotFound(res);
  });
};

module.exports.getPicture = (req, res, thumbnail) => {
  if(!req.params.postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  var size = thumbnail ? 200 : 640;

  var image = new PostImage();
  image.findById(req.params.postid).then(function() {
    aws.s3Client.getSignedUrl('getObject', {
      Bucket: fs.Bucket.PostImagesResized,
      Key: image.data.id + '-' + size + '.' + image.data.extension
    }, function(err, url) {
      if(err) {
        console.error("Error getting signed url:", err);
        return error.InternalServerError(res);
      }
      return success.OK(res, url);
    });
  }, function(err) {
    if(err) {
      console.error("Error fetching post image:", err);
      return error.InternalServerError(res);
    }
    return error.NotFound(res);
  });
};

module.exports.flagPost = (req, res) => {
  if(!req.user || !req.user.username) {
    return error.Forbidden(res);
  }

  if(!req.params.postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  if(!req.body.flag_type || (req.body.flag_type !== 'branch_rules' && req.body.flag_type !== 'site_rules'
     && req.body.flag_type !== 'wrong_type' && req.body.flag_type !== 'nsfw')) {
    return error.BadRequest(res, 'Missing/invalid flag_type');
  }

  if(!req.body.branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  var flaggedpost = new FlaggedPost();
  var origpost = new Post();
  new Promise(function(resolve, reject) {
    // check if post has already been flagged
    flaggedpost.findByPostAndBranchIds(req.params.postid, req.body.branchid).then(function() {
      resolve();
    }, function(err) {
      if(err) {
        console.error("Error fetching flagged post:", err);
        return error.InternalServerError(res);
      }
      // no flagged post exists: create one.
      // first fetch the original post object
      return origpost.findByPostAndBranchIds(req.params.postid, req.body.branchid);
    }).then(function() {
      // now create a flagged post
      flaggedpost = new FlaggedPost({
        id: origpost.data.id,
        branchid: origpost.data.branchid,
        type: origpost.data.type,
        date: new Date().getTime(),
        branch_rules_count: 0,
        site_rules_count: 0,
        wrong_type_count: 0,
        nsfw_count: 0
      });
      return flaggedpost.save();
    }).then(resolve, reject);
  }).then(function () {
    // flagged post instatiated - now update counts
    flaggedpost.set(req.body.flag_type + '_count', flaggedpost.data[req.body.flag_type + '_count'] + 1);
    return flaggedpost.update();
  }).then(function() {
    // get branch mods
    return new Mod().findByBranch(req.body.branchid);
  }).then(function(mods) {
    // notify branch mods that post was flagged
    var promises = [];
    var time = new Date().getTime();
    for(var i = 0; i < mods.length; i++) {
      var notification = new Notification({
        id: mods[i].username + '-' + time,
        user: mods[i].username,
        date: time,
        unread: true,
        type: NotificationTypes.POST_FLAGGED,
        data: {
          branchid: req.body.branchid,
          username: req.user.username,
          postid: req.params.postid,
          reason: req.body.flag_type
        }
      });
      var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
      var invalids = notification.validate(propertiesToCheck);
      if(invalids.length > 0) {
        console.error('Error creating notification.');
        return error.InternalServerError(res);
      }
      promises.push(notification.save());
    }
    return Promise.all(promises);
  }).then(function() {
    return success.OK(res);
  }).catch(function(err) {
    if(err) {
      console.error("Error flagging post: ", err);
      return error.InternalServerError(res);
    }
    return error.NotFound(res);
  });
};

module.exports.putComment = (req, res) => {
  if(!req.params.postid) {
    return error.BadRequest(res, 'Missing postid');
  }
  if(!req.params.commentid) {
    return error.BadRequest(res, 'Missing commentid');
  }
  if(!req.user.username) {
    console.error("No username found in session.");
    return error.InternalServerError(res);
  }

  // ensure new comment text is valid
  if(!req.body.text) {
    return error.BadRequest(res, 'Missing text');
  }
  var updatedCommentData = new CommentData({
    id: req.params.commentid
  });
  updatedCommentData.set('text', req.body.text);
  updatedCommentData.set('edited', true);
  // validate comment properties
  var propertiesToCheck = ['id', 'text'];
  var invalids = updatedCommentData.validate(propertiesToCheck);
  if(invalids.length > 0) {
    return error.BadRequest(res, 'Invalid ' + invalids[0]);
  }

  var comment = new Comment();
  // check the specfied comment actually belongs to this post
  comment.findById(req.params.commentid).then(function() {
    if(comment.data.postid != req.params.postid) {
      return error.NotFound(res);
    }

    // update the comment
    return updatedCommentData.update();
  }).then(function() {
    return success.OK(res);
  }).catch(function() {
    console.error('Error updating comment.');
    return error.InternalServerError(res);
  });
};
