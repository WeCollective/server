'use strict';

const _ = require('lodash');
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

    return Promise.resolve();
  },
};

const self = module.exports = {
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
      .then(data => success.OK(res, data))
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

  // todo Check the specfied comment actually belongs to this post.
  getOneComment(id, req) {
    return new Promise((resolve, reject) => {
      new Promise((resolve, reject) => {
        return resolve(new CommentData.findById(id));
      })
      .then(data => resolve(data))
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

        new PostData()
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



  post(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    if(!req.body.title || req.body.title.length == 0) {
      return error.BadRequest(res, 'Invalid title');
    }

    try {
      req.body.branchids = JSON.parse(req.body.branchids);
    } catch(err) {
      return error.BadRequest(res, 'Malformed branchids.');
    }
    if(!req.body.branchids || req.body.branchids.length == 0 || req.body.branchids.length > 5) {
      return error.BadRequest(res, 'Invalid branchids');
    }

    // fetch the tags of each specfied branch. The union of these is the list of
    // the branches the post should be tagged to.
    var allTags = [];
    var tagCollectionPromises = [];
    var branchCollectionPromises = [];
    for(var i = 0; i < req.body.branchids.length; i++) {
      branchCollectionPromises.push(new Branch().findById(req.body.branchids[i]));
      tagCollectionPromises.push(new Promise(function(resolve, reject) {
        new Tag().findByBranch(req.body.branchids[i]).then(function(tags) {
          for(var j = 0; j < tags.length; j++) {
            allTags.push(tags[j].tag);
          }
          resolve();
        }, function(err) {
          if(err) {
            reject();
          }
          resolve();
        });
      }));
    }
    Promise.all(branchCollectionPromises).then(function() {
      return Promise.all(tagCollectionPromises);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      // one of the specified branches doesnt exist
      return error.BadRequest(res, 'Invalid branchid');
    }).then(function() {
      // all tags are collected, these are the branchids to tag the post to
      var original_branches = req.body.branchids;
      req.body.branchids = _.union(allTags);

      var date = new Date().getTime();
      var id = req.user.username + '-' + date;

      var propertiesToCheck, invalids;
      var posts = [];
      for(var i = 0; i < req.body.branchids.length; i++) {
        var post = new Post({
          id: id,
          branchid: req.body.branchids[i],
          date: date,
          type: req.body.type,
          local: 0,
          individual: 0,
          global: 0,
          up: 0,
          down: 0,
          comment_count: 0,
          nsfw: !!req.body.nsfw,
          locked: !!req.body.locked
        });

        // validate post properties
        propertiesToCheck = ['id', 'branchid', 'date', 'type', 'local', 'individual', 'global', 'up', 'down', 'comment_count', 'nsfw', 'locked'];
        invalids = post.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }
        posts.push(post);
      }

      var postdata = new PostData({
        id: id,
        creator: req.user.username,
        title: req.body.title,
        text: req.body.text,
        original_branches: JSON.stringify(original_branches)
      });

      // validate postdata properties
      propertiesToCheck = ['id', 'creator', 'title', 'text', 'original_branches'];
      invalids = postdata.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }

      // Check all the specified branches exist
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        promises.push(new Branch().findById(posts[i].data.branchid));
      }

      Promise.all(promises).then(function () {
        // save a post entry for each specified branch
        promises = [];
        for(var i = 0; i < posts.length; i++) {
          promises.push(posts[i].save());
        }

        var user = new User();
        Promise.all(promises).then(function() {
          return postdata.save();
        }).then(function() {
          // increment the post counters on the branch objects
          var promises = [];
          for(var i = 0; i < req.body.branchids.length; i++) {
            var promise = new Promise(function(resolve, reject) {
              var branch = new Branch();
              branch.findById(req.body.branchids[i]).then(function() {
                branch.set('post_count', branch.data.post_count + 1);
                branch.update().then(resolve, reject);
              }, reject);
            });
            promises.push(promise);
          }
          return Promise.all(promises);
        }).then(function() {
          // get user
          return user.findByUsername(req.user.username);
        }).then(function() {
          // increment user's post count
          user.set('num_posts', user.data.num_posts + 1);
          return user.update();
        }).then(function () {
          // update the SendGrid contact list with the new user data
          return mailer.addContact(user.data, true);
        }).then(function() {
          // successfully create post, send back its id
          return success.OK(res, id);
        }).catch(function() {
          return error.InternalServerError(res);
        });
      }, function(err) {
        if(err) {
          return error.InternalServerError(res);
        }
        return error.NotFound(res, 'One of the specified branches doesn\'t exist.');
      });
    }, function() {
      console.error("Error fetching branch tags.");
      return error.InternalServerError(res);
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
          branchid: posts[i].branchid
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

  postComment(req, res) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var date = new Date().getTime();
    var id = req.user.username + '-' + date;
    var comment = new Comment({
      id: id,
      postid: req.params.postid,    // ensure exists
      parentid: req.body.parentid,  // ensure exists and in this post
      individual: 0,
      replies: 0,
      up: 0,
      down: 0,
      date: date,
      rank: 0
    });

    // validate comment properties
    var propertiesToCheck = ['id', 'postid', 'parentid', 'individual', 'replies', 'up', 'down', 'date', 'rank'];
    var invalids = comment.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    var commentdata = new CommentData({
      id: id,
      creator: req.user.username,
      date: date,
      text: req.body.text,
      edited: false
    });

    // validate comment data properties
    propertiesToCheck = ['id', 'creator', 'date', 'text', 'edited'];
    invalids = commentdata.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // ensure the specified post exists
    var parent = new Comment();
    var user = new User();
    var commentPosts; // the post entries (one for each branch) this comment belongs to
    new Post().findById(req.params.postid, 0).then(function(posts) {
      if(!posts || posts.length == 0) {
        return error.NotFound(res);
      }
      commentPosts = posts;
      // if this is a root comment, continue
      if(req.body.parentid == 'none') {
        return new Promise(function(resolve, reject) {
          resolve();
        });
      } else {
        // otherwise, ensure the specified parent comment exists
        return parent.findById(req.body.parentid);
      }
    }).then(function() {
      // ensure the parent comment belongs to this post
      if(req.body.parentid != 'none' && parent.data.postid != req.params.postid) {
        return error.BadRequest(res, 'Parent comment does not belong to the same post');
      }

      // all is well - save the new comment
      return comment.save();
    }).then(function() {
      // save the comment data
      return commentdata.save();
    }).then(function() {
      // if this is a root comment, continue
      if(req.body.parentid == 'none') {
        return new Promise(function(resolve, reject) {
          resolve();
        });
      } else {
        // otherwise, increment the number of replies on the parent
        parent.set('replies', parent.data.replies + 1);
        return parent.update();
      }
    }).then(function() {
      // increment the number of comments on the post
      var promises = [];
      for(var i = 0; i < commentPosts.length; i++) {
        var post = new Post(commentPosts[i]);
        post.set('comment_count', commentPosts[i].comment_count + 1);
        promises.push(post.update());
      }
      return Promise.all(promises);
    }).then(function () {
      // find all post entries to get the list of branches it is tagged to
      return new Post().findById(req.params.postid);
    }).then(function(posts) {
      // increment the post comments count on each branch object
      // the post appears in
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        promises.push(new Promise(function(resolve, reject) {
          var branch = new Branch();
          branch.findById(posts[i].branchid).then(function() {
            branch.set('post_comments', branch.data.post_comments + 1);
            branch.update().then(resolve, reject);
          }, reject);
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      // notify the post or comment author that a comment has been
      // posted on their content

      // get the username of the post or comment author
      return new Promise(function(resolve, reject) {
        // fetch the id of a valid branch which the post appears in
        new Post().findById(req.params.postid).then(function(posts) {
          // take the first branch this post appears in (there are many)
          // for the purposes of viewing the notification
          var branchid = posts[0].branchid;
          if(req.body.parentid == 'none') {
            // root comment, get post author
            var postdata = new PostData();
            postdata.findById(req.params.postid).then(function() {
              resolve({
                author: postdata.data.creator,
                branchid: branchid
              });
            }, reject);
          } else {
            // comment reply, get parent comment author
            var commentdata = new CommentData();
            commentdata.findById(req.body.parentid).then(function() {
              resolve({
                author: commentdata.data.creator,
                branchid: branchid
              });
            }, reject);
          }
        }, reject);
      });
    }).then(function(data) {
      // notify the author that their content has been commented on/replied to

      // don't notify the author if they are commenting/posting on their own content
      if(req.user.username == data.author) {
        return new Promise(function(resolve, reject) {
          resolve();
        });
      }

      var time = new Date().getTime();
      var notification = new Notification({
        id: data.author + '-' + time,
        user: data.author,
        date: time,
        unread: true,
        type: NotificationTypes.COMMENT,
        data: {
          postid: req.params.postid,
          parentid: req.body.parentid,
          commentid: id,
          username: req.user.username,
          branchid: data.branchid
        }
      });

      var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
      var invalids = notification.validate(propertiesToCheck);
      if(invalids.length > 0) {
        console.error('Error creating notification. Invalids: ', invalids);
        return error.InternalServerError(res);
      }

      return notification.save(req.sessionID);
    }).then(function () {
      // get the user
      return user.findByUsername(req.user.username);
    }).then(function () {
      // increment the user comment count
      user.set('num_comments', user.data.num_comments + 1);
      return user.update();
    }).then(function () {
      // update the SendGrid contact list with the new user data
      return mailer.addContact(user.data, true);
    }).then(function() {
      // return the comment id to the client
      return success.OK(res, id);
    }).catch(function(err) {
      if(err) {
        console.error("Error posting comment: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },

  getComments(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    // if parentid not specified, get root comments
    if(!req.query.parentid) {
      req.query.parentid = 'none';
    }

    // ascertain how to sort the comments (points, replies, date). Default points
    var sort = req.query.sort;
    if(!req.query.sort) {
      sort = 'points';
    }

    var lastComment = null;
    var comments = [];
    var commentDatas = [];
    // if lastCommentId is specified, client wants results which appear _after_ this comment (pagination)
    new Promise(function(resolve, reject) {
      if(req.query.lastCommentId) {
        var comment = new Comment();
        // get the comment
        comment.findById(req.query.lastCommentId).then(function () {
          // create lastComment object
          lastComment = comment.data;
          resolve();
        }).catch(function(err) {
          if(err) reject();
          return error.NotFound(res); // lastCommentId is invalid
        });
      } else {
        // no last comment specified, continue
        resolve();
      }
    }).then(function () {
      return new Comment().findByParent(req.params.postid, req.query.parentid, sort, lastComment);
    }).then(function(results) {
      comments = results;
      var promises = [];
      // fetch post data for each post
      for(var i = 0; i < comments.length; i++) {
        var commentdata = new CommentData();
        promises.push(commentdata.findById(comments[i].id));
        commentDatas.push(commentdata);
      }
      return Promise.all(promises);
    }).then(function() {
      // attach comment data to each comment
      for(var i = 0; i < comments.length; i++) {
        comments[i].data = commentDatas[i].data;
      }
      return success.OK(res, comments);
    }).catch(function(err) {
      if(err) {
        console.error("Error fetching comments", err);
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
