'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var Post = require('../../models/post.model.js');

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

    var stat = req.query.stat;
    if(!req.query.stat) {
      stat = 'individual';
    }

    new Post().findByBranch(req.params.branchid, timeafter, stat).then(function(posts) {
      return success.OK(res, posts);
    }, function () {
      console.error('Error fetching posts on branch.');
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

    new Post().findById(req.params.postid).then(function(posts) {
      // find the post on the specified branchid
      for(var i = 0; i < posts.length; i++) {
        if(posts[i].branchid == req.params.branchid) {
          // update the post vote up/down parameter
          // (vote stats will be auto-updated by a lambda function)
          post.set(req.body.vote, posts[i][req.body.vote] + 1);
          return post.update();
        }
      }
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error('Error voting on a post.');
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

    new Post().findByPostAndBranchIds(req.params.postid, req.params.branchid).then(function(post) {
      if(!post || post.length == 0) {
        return error.NotFound(res);
      }
      return success.OK(res, post);
    }, function(err) {
      if(err) {
        console.error('Error fetching post on branch.');
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
