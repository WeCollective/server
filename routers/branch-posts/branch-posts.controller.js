'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var Post = require('../../models/post.model.js');
var Branch = require('../../models/branch.model.js');

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

    var sortBy = req.query.sortBy;
    if(!req.query.sortBy) {
      sortBy = 'points';
    }

    var stat = req.query.stat;
    if(!req.query.stat) {
      stat = 'individual';
    }

    new Post().findByBranch(req.params.branchid, timeafter, sortBy, stat).then(function(posts) {
      return success.OK(res, posts);
    }, function(err) {
      console.error('Error fetching posts on branch: ', err);
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
      return success.OK(res, post);
    }, function(err) {
      if(err) {
        console.error('Error fetching post on branch:', err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
