'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var Branch = require('../../models/branch.model.js');
var Post = require('../../models/post.model.js');
var PostData = require('../../models/post-data.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  post: function(req, res) {
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

    var date = new Date().getTime();
    var id = req.user.username + '-' + date;

    var propertiesToCheck, invalids;
    var posts = [];
    for(var i = 0; i < req.body.branchids.length; i++) {
      var post = new Post({
        id: id,
        branchid: req.body.branchids[i],
        type: req.body.type,
        local: 0,
        individual: 0,
        up: 0,
        down: 0
      });

      // validate post properties
      propertiesToCheck = ['id', 'branchid', 'type', 'local', 'individual', 'up', 'down'];
      invalids = post.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }
      posts.push(post);
    }

    var postdata = new PostData({
      id: id,
      creator: req.user.username,
      date: date,
      title: req.body.title,
      text: req.body.text
    });

    // validate postdata properties
    propertiesToCheck = ['id', 'creator', 'date', 'title', 'text'];
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

      Promise.all(promises).then(function() {
        return postdata.save();
      }).then(function() {
        return success.OK(res);
      }).catch(function() {
        return error.InternalServerError(res);
      });
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res, 'One of the specified branches doesn\'t exist.');
    });
  }
};
