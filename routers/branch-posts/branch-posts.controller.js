'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var ACL = require('../../config/acl.js');
var NotificationTypes = require('../../config/notification-types.js');

var Post = require('../../models/post.model.js');
var PostData = require('../../models/post-data.model.js');
var FlaggedPost = require('../../models/flagged-post.model.js');
var Notification = require('../../models/notification.model.js');
var Branch = require('../../models/branch.model.js');
var Mod = require('../../models/mod.model.js');

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

    var flag = req.query.flag === 'true';

    // points, date, comment_count [if normal posts]
    // date, branch_rules, site_rules, wrong_type [if flagged posts i.e. flag = true]
    var sortBy = req.query.sortBy;
    if(!req.query.sortBy) {
      sortBy = flag ? 'date' : 'points';
    }

    new Promise(function(resolve, reject) {
      if(flag) {
        // ensure valid sortBy param supplied for fetching flagged posts
        if(['date', 'branch_rules', 'site_rules', 'wrong_type'].indexOf(sortBy) == -1) {
          return error.BadRequest(res, 'Invalid sortBy parameter');
        }
        // if requesting flagged posts ensure user is authenticated and is a mod
        if(!req.user.username) {
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
    }).then(function() {
      // ind/local/global stats [if normal posts]
      var stat = req.query.stat;
      if(!req.query.stat) {
        stat = 'individual';
      }


      (flag ? new FlaggedPost() : new Post()).findByBranch(req.params.branchid, timeafter, sortBy, stat).then(function(posts) {
        return success.OK(res, posts);
      }, function(err) {
        console.error('Error fetching posts on branch: ', err);
        return error.InternalServerError(res);
      });
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

    // validate post properties
    var propertiesToCheck = ['id', 'branchid'];
    var invalids = post.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    var branchIds = [];
    new Post().findById(req.params.postid).then(function(posts) {
      // find all post entries to get the list of branches it is tagged to
      var promise;
      for(var i = 0; i < posts.length; i++) {
        branchIds.push(posts[i].branchid);
        // find the post on the specified branchid
        if(posts[i].branchid == req.params.branchid) {
          // update the post vote up/down parameter
          // (vote stats will be auto-updated by a lambda function)
          post.set(req.body.vote, posts[i][req.body.vote] + 1);
          promise = post.update();
        }
      }
      return promise;
    }).then(function() {
      // increment/decrement the post points count on each branch object
      // the post appears in
      var promises = [];
      var inc = (req.body.vote == 'up') ? 1 : -1;
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

    if(!req.body.action || (req.body.action !== 'change_type' && req.body.action !== 'remove' && req.body.action !== 'approve')) {
      return error.BadRequest(res, 'Missing/invalid action parameter');
    }

    if(req.body.action === 'change_type' && !req.body.type) {
      return error.BadRequest(res, 'Missing type parameter');
    }
    if(req.body.action === 'remove' && !req.body.reason) {
      return error.BadRequest(res, 'Missing reason parameter');
    }

    if(req.body.action === 'change_type') {
      var postdata = new PostData();
      // get the original post
      postdata.findById(req.params.postid).then(function() {
        // change post type for all branches it appears in
        return new Post().findById(req.params.postid);
      }).then(function(posts) {
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
          type: NotificationTypes.POST_TYPE_CHANGED,
          data: {
            branchid: req.params.branchid,
            username: req.user.username,
            postid: req.params.postid,
            type: req.body.type
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
          // get global mods
          var promises = [];
          var time = new Date().getTime();
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
