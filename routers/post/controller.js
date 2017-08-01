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

const self = module.exports = {
  deleteComment(req, res) {
    const commentid = req.params.commentid;
    const postid = req.params.postid;

    if (!commentid) {
      return error.BadRequest(res, 'Missing commentid');
    }

    if (!postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    self.getOneComment(commentid, req)
      .then(comment => {
        if (comment.data.creator !== req.user.username) {
          return Promise.reject({
            code: 403,
            message: `You cannot delete other user's comments!`,
          });
        }

        const commentdata = new CommentData({ id: comment.id });

        if (comment.replies === 0) {
          // todo Decrease comment count on post...
          return commentdata
            .delete()
            .then(() => new Comment().delete({ id: comment.id }));
        }

        // Removing the comment would cut off the replies, we don't want that.
        commentdata.set('creator', 'N/A');
        commentdata.set('text', '[Comment removed by user]');
        return commentdata.update();
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
  },

  get(req, res) {
    const postid = req.params.postid;

    if (!postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    self.getOnePost(postid, req)
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
  },

  getComment(req, res) {
    const commentId = req.params.commentid;
    const postId = req.params.postid;

    if (!postId) {
      return error.BadRequest(res, 'Missing postid');
    }

    if (!commentId) {
      return error.BadRequest(res, 'Missing commentid');
    }

    self.getOneComment(commentId, req)
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
  },

  getComments(req, res) {
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
    let lastComment = null;

    new Promise((resolve, reject) => {
      // Client wants only results that appear after this comment (pagination).
      if (req.query.lastCommentId) {
        const comment = new Comment();

        comment
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
      .then(results => {
        comments = results;

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
      .then(() => success.OK(res, comments))
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
  },

  // todo Check the specfied comment actually belongs to this post.
  getOneComment(id, req) {
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
  },

  getOnePost(id, req) {
    let post;

    return new Promise((resolve, reject) => {
      new Promise((resolve, reject) => {
        return resolve(new Post().findById(id));
      })
        .then(posts => {
          if (!posts || posts.length === 0) {
            return Promise.reject({ code: 404 });
          }

          let idx = 0;

          for (let i = 0; i < posts.length; i++) {
            if (posts[i].branchid === 'root') {
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
        .then(() => {
          return Promise.resolve(new Promise((resolve, reject) => {
            this.getPostPicture(id, false)
              .then(url => {
                post.profileUrl = url;
                return resolve();
              })
          }));
        })
        // Attach post image thumbnail url to each post.
        .then(() => {
          return Promise.resolve(new Promise((resolve, reject) => {
            this.getPostPicture(id, true)
              .then(url => {
                post.profileUrlThumb = url;
                return resolve();
              })
          }));
        })
        // Extend the posts with information about user vote.
        .then(() => {
          if (req && req.user && req.user.username) {
            return new Promise((resolve, reject) => {
              new Vote()
                .findByUsernameAndItemId(req.user.username, `post-${post.id}`)
                .then(existingVoteData => {
                  if (existingVoteData) {
                    post.votes.userVoted = existingVoteData.direction;
                  }

                  return resolve();
                })
                .catch(reject);
            });
          }

          return Promise.resolve();
        })
        .then(() => resolve(post))
        .catch(err => {
          if (err) {
            console.error(`Error fetching post data: `, err);
          }

          return reject(err);
        });
    });
  },

  getPostPicture(postid, thumbnail = false) {
    return new Promise((resolve, reject) => {
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
  },

  post(req, res) {
    // fetch the tags of each specfied branch. The union of these is the list of
    // the branches the post should be tagged to.
    const branchidsArr = [];
    const user = new User();

    let id;

    return post.verifyParams(req)
      .then(req => {
        const tagPromises = [];

        for (let i = 0; i < req.body.branchids.length; i += 1) {
          const branchid = req.body.branchids[i];
          tagPromises.push(new Promise((resolve, reject) => new Tag()
            .findByBranch(branchid)
            .then(tags => {
              // All tags are collected, these are the branchids to tag the post to.
              for (let j = 0; j < tags.length; j += 1) {
                if (!branchidsArr.includes(tags[j].tag)) {
                  branchidsArr.push(tags[j].tag);
                }
              }

              return resolve();
            })
            .catch(err => reject(err))
          ));
        }

        return Promise.all(tagPromises);
      })
      .then(() => {
        const date = new Date().getTime();
        const promises = [];

        id = `${req.user.username}-${date}`;

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
      .then(() => {
        const newPostData = new PostData({
          creator: req.user.username,
          id,
          original_branches: JSON.stringify(req.body.branchids),
          text: req.body.text,
          title: req.body.title,
        });

        const invalids = newPostData.validate();
        if (invalids.length > 0) {
          return Promise.reject({
            code: 400,
            message: `Invalid ${invalids[0]}.`,
          });
        }

        return newPostData.save();
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
  },

  postComment(req, res) {
    if (!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if (!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    const date = new Date().getTime();
    const id = `${req.user.username}-${date}`;
    const comment = new Comment({
      date,
      down: 0,
      id,
      individual: 0,
      parentid: req.body.parentid,
      postid: req.params.postid,
      rank: 0,
      replies: 0,
      up: 0,
    });

    const commentdata = new CommentData({
      creator: req.user.username,
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

    new Post()
      .findById(req.params.postid, 0)
      .then(posts => {
        if (!posts || posts.length === 0) {
          return error.NotFound(res);
        }

        commentPosts = posts;

        // if this is a root comment, continue
        if (req.body.parentid === 'none') {
          return Promise.resolve();
        }

        // otherwise, ensure the specified parent comment exists
        return parent.findById(req.body.parentid);
      })
      .then(() => {
        // Parent comment must belong to this post.
        if (req.body.parentid !== 'none' && parent.data.postid !== req.params.postid) {
          return error.BadRequest(res, 'Parent comment does not belong to the same post');
        }

        return comment.save();
      })
      .then(() => commentdata.save())
      .then(() => {
        if (req.body.parentid === 'none') {
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
      .then(() => new Post().findById(req.params.postid))
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
      // notify the post or comment author that a comment has been
      // posted on their content
      // get the username of the post or comment author
      // fetch the id of a valid branch which the post appears in
      .then(() => new Post()
        .findById(req.params.postid)
        .then(posts => {
          // take the first branch this post appears in (there are many)
          // for the purposes of viewing the notification
          const branchid = posts[0].branchid;
          // root comment, get post author
          // comment reply, get parent comment author
          const model = req.body.parentid === 'none' ? new PostData() : new CommentData();
          return model
            .findById(req.body.parentid === 'none' ? req.params.postid : req.body.parentid)
            .then(() => Promise.resolve({
              author: model.data.creator,
              branchid,
            }));
        })
        .catch(err => Promise.reject(err))
      )
      // Notify the author that their content has been interacted with.
      .then(data => {
        // Skip if interacting with our own content.
        if (req.user.username === data.author) {
          return Promise.resolve();
        }

        const time = new Date().getTime();
        const notification = new Notification({
          data: {
            branchid: data.branchid,
            commentid: id,
            parentid: req.body.parentid,
            postid: req.params.postid,
            username: req.user.username,
          },
          date: time,
          id: `${data.author}-${time}`,
          type: NotificationTypes.COMMENT,
          unread: true,
          user: data.author,
        });

        const invalids = notification.validate();
        if (invalids.length > 0) {
          console.error('Error creating notification. Invalids: ', invalids);
          return error.InternalServerError(res);
        }

        return notification.save(req.sessionID);
      })
      .then(() => user.findByUsername(req.user.username))
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
  },

  voteComment(req, res) {
    const vote = new Vote();

    let comment;
    let newVoteDirection;
    let newVoteOppositeDirection;
    let resData = { delta: 0 };
    let userAlreadyVoted = false;

    voteComment.verifyParams(req)
      .then(() => {
        comment = new Comment({
          id: req.params.commentid,
          postid: req.params.postid,
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

        return vote.findByUsernameAndItemId(req.user.username, `comment-${req.params.commentid}`);
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
      .then(() => comment.findById(req.params.commentid))
      // Update the comment "up" and "down" attributes.
      .then(() => {
        // Check the specfied comment actually belongs to this post.
        if (comment.data.postid !== req.params.postid) {
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
          itemid: `comment-${req.params.commentid}`,
          username: req.user.username,
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
  },





  delete(req, res) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    // delete all post entries on branches
    // NB: do not remove post data and post images for now - may want to
    // reinstate posts
    new Post().findById(req.params.postid).then(function(posts) {
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        promises.push(new Post().delete({
          id: posts[i].id,
          branchid: posts[i].branchid
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      // delete any instances of the post when flagged
      return new FlaggedPost().findById(req.params.postid);
    }).then(function(posts) {
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        promises.push(new FlaggedPost().delete({
          id: posts[i].id,
          branchid: posts[i].branchid,
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error deleting posts: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },

  getPictureUploadUrl(req, res) {
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
  },

  getPicture(req, res, thumbnail) {
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
  },

  flagPost(req, res) {
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
        promises.push(notification.save(req.sessionID));
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
  },

  putComment(req, res) {
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
  }
};
