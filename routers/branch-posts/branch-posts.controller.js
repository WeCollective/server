'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var ACL = require('../../config/acl.js');
var NotificationTypes = require('../../config/notification-types.js');

var Post = require('../../models/post.model.js');
var PostData = require('../../models/post-data.model.js');
var PostImage = require('../../models/post-image.model.js');
var FlaggedPost = require('../../models/flagged-post.model.js');
var Notification = require('../../models/notification.model.js');
var Branch = require('../../models/branch.model.js');
var User = require('../../models/user.model.js');
var Mod = require('../../models/mod.model.js');
var UserVote = require('../../models/user-vote.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  get: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var timeafter = req.query.timeafter;
    if(!req.query.timeafter) {
      timeafter = 0;
    }

    // indicates whether to fetch flagged posts only
    var flag = req.query.flag === 'true';

    // points, date, comment_count [if normal posts]
    // date, branch_rules, site_rules, wrong_type [if flagged posts i.e. flag = true]
    var sortBy = req.query.sortBy;
    if(!req.query.sortBy) {
      sortBy = flag ? 'date' : 'points';
    }

    // check for valid postType parameter
    var postType = req.query.postType;
    if(!req.query.postType) {
      postType = 'all';
    } else if(['all', 'text', 'image', 'page', 'video', 'audio', 'poll'].indexOf(req.query.postType) === -1) {
      return error.BadRequest(res, 'Invalid postType')
    }

    var posts = [];
    var postDatas = [];
    var postImages = [];
    var lastPost = null;
    var nsfw = false;
    // if lastPostId is specified, client wants results which appear _after_ this post (pagination)
    new Promise(function(resolve, reject) {
      if(req.query.lastPostId) {
        var post = new Post();
        var postdata = new PostData();
        // get the post
        post.findByPostAndBranchIds(req.query.lastPostId, req.params.branchid).then(function() {
          // fetch post data
          return postdata.findById(req.query.lastPostId);
        }).then(function () {
          // create lastPost object
          lastPost = post.data;
          lastPost.data = postdata.data;
          resolve();
        }).catch(function(err) {
          if(err) reject();
          return error.NotFound(res); // lastPostId is invalid
        });
      } else {
        // no last post specified, continue
        resolve();
      }
    }).then(function() {
      // if user is authenticated, fetch whether they should see nsfw posts
      return new Promise(function(resolve, reject) {
        if(req.isAuthenticated() && req.user.username) {
          var user = new User();
          user.findByUsername(req.user.username).then(function() {
            nsfw = user.data.show_nsfw;
            resolve();
          }, reject);
        } else {
          resolve();
        }
      });
    }).then(function () {
      return new Promise(function(resolve, reject) {
        if(flag) {
          // ensure valid sortBy param supplied for fetching flagged posts
          if(['date', 'branch_rules', 'site_rules', 'wrong_type', 'nsfw'].indexOf(sortBy) == -1) {
            return error.BadRequest(res, 'Invalid sortBy parameter');
          }
          // if requesting flagged posts ensure user is authenticated and is a mod
          if(!req.user) {
            return error.Forbidden(res);
          } else {
            ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, resolve);
          }
        } else {
          // ensure valid sortBy param supplied for fetching normal posts
          if(['date', 'points', 'comment_count'].indexOf(sortBy) == -1) {
            return error.BadRequest(res, 'Invalid sortBy parameter');
          } else {
            resolve();
          }
        }
      });
    }).then(function() {
      // ind/local/global stats [if normal posts]
      var stat = req.query.stat;
      if(!req.query.stat) {
        stat = 'individual';
      }
      return (flag ? new FlaggedPost() : new Post()).findByBranch(req.params.branchid, timeafter, nsfw, sortBy, stat, postType, lastPost);
    }).then(function(results) {
      posts = results;
      var promises = [];
      // fetch post data for each post
      for(var i = 0; i < posts.length; i++) {
        var postdata = new PostData();
        promises.push(postdata.findById(posts[i].id));
        postDatas.push(postdata);
      }
      return Promise.all(promises);
    }).then(function() {
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        // attach post data to each post
        posts[i].data = postDatas[i].data;
        // fetch each post's signed image url and attach it to the postimage object
        promises.push(new Promise(function(resolve, reject) {
          new PostImage().findById(posts[i].id).then(function(postimage) {
            aws.s3Client.getSignedUrl('getObject', {
              Bucket: fs.Bucket.PostImagesResized,
              Key: postimage.id + '-640.' + postimage.extension
            }, function(err, url) {
              if(err) reject(err);
              resolve(url);
            });
          }, function(err) {
            if(err) reject();
            resolve('');
          });
        }));
      }
      return Promise.all(promises);
    }).then(function(urls) {
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        // attach post image url to each post
        posts[i].profileUrl = urls[i];
        // fetch each post's signed image url and attach it to the postimage object
        promises.push(new Promise(function(resolve, reject) {
          new PostImage().findById(posts[i].id).then(function(postimage) {
            aws.s3Client.getSignedUrl('getObject', {
              Bucket: fs.Bucket.PostImagesResized,
              Key: postimage.id + '-200.' + postimage.extension
            }, function(err, url) {
              if(err) reject(err);
              resolve(url);
            });
          }, function(err) {
            if(err) reject();
            resolve('');
          });
        }));
      }
      return Promise.all(promises);
    }).then(function(urls) {
      // attach post image thumbnail url to each post
      for(var i = 0; i < posts.length; i++) {
        posts[i].profileUrlThumb = urls[i];
      }
      return success.OK(res, posts);
    }).catch(function(err) {
      console.error("Error fetching posts:", err);
      return error.InternalServerError(res);
    });
  },
  put: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    if(!req.body.vote || (req.body.vote != 'up' && req.body.vote != 'down')) {
      return error.BadRequest(res, 'Missing or malformed vote parameter');
    }

    var post = new Post({
      id: req.params.postid,
      branchid: req.params.branchid
    });

    var branchIds = [];
    // check user hasn't already voted on this post
    var uservote = new UserVote();
    var voteChanged = false;
    uservote.findByUsernameAndItemId(req.user.username, 'post-' + req.params.postid).then(function () {
      // user has voted on this post before

      // see if vote is the other direction, in which can change their vote
      if(uservote.data.direction !== req.body.vote) {
        // get post on all branches
        voteChanged = true;
        return new Post().findById(req.params.postid);
      } else {
        return error.BadRequest(res, 'User has already voted on this post');
      }
    }, function(err) {
      if(err) {
        console.error("Error fetching user vote:", err);
        return error.InternalServerError(res);
      }
      // get post on all branches
      return new Post().findById(req.params.postid);
    }).then(function(posts) {
      // find all post entries to get the list of branches it is tagged to
      var promise;
      for(var i = 0; i < posts.length; i++) {
        branchIds.push(posts[i].branchid);
        // find the post on the specified branchid
        if(posts[i].branchid == req.params.branchid) {
          // update the post vote up/down parameter
          // (vote stats will be auto-updated by a lambda function)
          post.set(req.body.vote, posts[i][req.body.vote] + 1);

          // if user is changing their vote, undo the previous vote by decreasing it
          if(voteChanged) {
            var opposite = req.body.vote == 'up' ? 'down' : 'up';
            post.set(opposite, posts[i][opposite] - 1);
          }
          promise = post.update();
        }
      }
      if(!promise) return error.BadRequest(res, 'Invalid branchid');
      return promise;
    }).then(function() {
      // increment/decrement the post points count on each branch object
      // the post appears in
      var promises = [];
      var inc = (req.body.vote == 'up') ? 1 : -1;
      // if the user is changing their vote, need to also undo effect of their
      // previous vote, so the vote counts as two
      if(voteChanged) {
        inc = inc == 1 ? inc + 1 : inc - 1;
      }
      for(var i = 0; i < branchIds.length; i++) {
        promises.push(new Promise(function(resolve, reject) {
          var branch = new Branch();
          branch.findById(branchIds[i]).then(function() {
            branch.set('post_points', branch.data.post_points + inc);
            branch.update().then(resolve, reject);
          }, reject);
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      if(voteChanged) {
        // update the vote direction
        uservote.set('direction', req.body.vote);
        return uservote.update();
      } else {
        // new vote: store this vote in the table
        var vote = new UserVote({
          username: req.user.username,
          itemid: 'post-' + req.params.postid,
          direction: req.body.vote
        });

        // validate vote properties
        var propertiesToCheck = ['username', 'itemid'];
        var invalids = vote.validate(propertiesToCheck);
        if(invalids.length > 0) {
          console.error("Error creating UserVote: invalid ", invalids[0]);
          return error.InternalServerError(res);
        }
        return vote.save();
      }
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error('Error voting on a post: ', err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getPost: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var post = new Post();
    post.findByPostAndBranchIds(req.params.postid, req.params.branchid).then(function() {
      return success.OK(res, post.data);
    }, function(err) {
      if(err) {
        console.error('Error fetching post on branch:', err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  resolveFlag: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    if(!req.body.action || (req.body.action !== 'change_type' && req.body.action !== 'remove' && req.body.action !== 'approve' && req.body.action !== 'mark_nsfw')) {
      return error.BadRequest(res, 'Missing/invalid action parameter');
    }

    if(req.body.action === 'change_type' && !req.body.type) {
      return error.BadRequest(res, 'Missing type parameter');
    }
    if(req.body.action === 'remove' && !req.body.reason) {
      return error.BadRequest(res, 'Missing reason parameter');
    }

    if(req.body.action === 'change_type' || req.body.action === 'mark_nsfw') {
      var originalpost = new Post();
      var postdata = new PostData();
      // get the post's data
      postdata.findById(req.params.postid).then(function() {
        if(req.body.action === 'change_type') {
          // change post type for all branches it appears in
          return new Post().findById(req.params.postid);
        } else {
          // get the original post
          return originalpost.findByPostAndBranchIds(req.params.postid, req.params.branchid);
        }
      }).then(function(posts) {
        if(req.body.action === 'change_type') {
          if(!posts || posts.length === 0) {
            return error.NotFound(res);
          }
          var promises = [];
          for(var i = 0; i < posts.length; i++) {
            var post = new Post();
            post.set('type', req.body.type);
            // validate post properties
            var propertiesToCheck = ['type'];
            var invalids = post.validate(propertiesToCheck);
            if(invalids.length > 0) {
              return error.BadRequest(res, 'Invalid type parameter');
            }
            promises.push(post.update({
              id: posts[i].id,
              branchid: posts[i].branchid
            }));
          }
          return Promise.all(promises);
        } else {
          originalpost.set('nsfw', true);
          return originalpost.update();
        }
      }).then(function () {
        // now delete post flags
        return new FlaggedPost().delete({
          id: req.params.postid,
          branchid: req.params.branchid
        });
      }).then(function() {
        // notify the OP that their post type was changed
        var time = new Date().getTime();
        var notification = new Notification({
          id: postdata.data.creator + '-' + time,
          user: postdata.data.creator,
          date: time,
          unread: true,
          type: (req.body.action === 'change_type') ? NotificationTypes.POST_TYPE_CHANGED : NotificationTypes.POST_MARKED_NSFW,
          data: {
            branchid: req.params.branchid,
            username: req.user.username,
            postid: req.params.postid
          }
        });
        if(req.body.action === 'change_type') notification.data.data.type = req.body.type;

        var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
        var invalids = notification.validate(propertiesToCheck);
        if(invalids.length > 0) {
          console.error('Error creating notification.');
          return error.InternalServerError(res);
        }
        return notification.save(req.sessionID);
      }).then(function() {
        return success.OK(res);
      }).catch(function(err) {
        if(err) {
          console.error('Error fetching post on branch:', err);
          return error.InternalServerError(res);
        }
        return error.NotFound(res);
      });
    } else if(req.body.action === 'remove') {
      var postdata = new PostData();
      // get the original post
      postdata.findById(req.params.postid).then(function() {
        // delete flag for this post on this branch
        return new FlaggedPost().delete({
          id: req.params.postid,
          branchid: req.params.branchid
        })
      }).then(function() {
        // delete actual post from this branch
        return new Post().delete({
          id: req.params.postid,
          branchid: req.params.branchid
        });
      }).then(function() {
        // notify the OP that their post was removed
        var time = new Date().getTime();
        var notification = new Notification({
          id: postdata.data.creator + '-' + time,
          user: postdata.data.creator,
          date: time,
          unread: true,
          type: NotificationTypes.POST_REMOVED,
          data: {
            branchid: req.params.branchid,
            username: req.user.username,
            postid: req.params.postid,
            reason: req.body.reason,
            message: req.body.message
          }
        });
        var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
        var invalids = notification.validate(propertiesToCheck);
        if(invalids.length > 0) {
          console.error('Error creating notification.');
          return error.InternalServerError(res);
        }
        return notification.save(req.sessionID);
      }).then(function() {
        // notify global mods of posts removed for breaching site rules
        if(req.body.reason === 'site_rules') {
          var promises = [];
          var time = new Date().getTime();
          // get global mods
          new Mod().findByBranch('root').then(function(mods) {
            for(var i = 0; i < mods.length; i++) {
              var notification = new Notification({
                id: mods[i].username + '-' + time,
                user: mods[i].username,
                date: time,
                unread: true,
                type: NotificationTypes.POST_REMOVED,
                data: {
                  branchid: req.params.branchid,
                  username: req.user.username,
                  postid: req.params.postid,
                  reason: req.body.reason,
                  message: req.body.message
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
            console.error("Error sending notification to root mods: ", err);
            return error.InternalServerError(res);
          });
        } else {
          return success.OK(res);
        }
      }).catch(function(err) {
        if(err) {
          console.error('Error fetching post on branch:', err);
          return error.InternalServerError(res);
        }
        return error.NotFound(res);
      });
    } else if(req.body.action === 'approve') {
      // delete flag for this post on this branch
      new FlaggedPost().delete({
        id: req.params.postid,
        branchid: req.params.branchid
      }).then(function() {
        return success.OK(res);
      }).catch(function(err) {
        if(err) {
          console.error('Error fetching post on branch:', err);
          return error.InternalServerError(res);
        }
        return error.NotFound(res);
      });
    } else {
      return error.BadRequest(res, 'Invalid action parameter');
    }
  }
};
