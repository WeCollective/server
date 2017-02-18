'use strict';

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

var Post = require('../../models/post.model.js');
var PollAnswer = require('../../models/poll-answer.model.js');

var _ = require('lodash');

module.exports = {
  post: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // ensure postid exists
    new Post().findById(req.params.postid).then(function(posts) {
      if(posts.length === 0) {
        return error.NotFound(res);
      }

      var date = new Date().getTime();

      // create new poll answer
      var answer = new PollAnswer({
        id: req.params.postid + '-' + date,
        postid: req.params.postid,
        votes: 0,
        text: req.body.text,
        creator: req.user.username,
        date: date
      });

      // validate request properties
      var propertiesToCheck = ['id', 'postid', 'votes', 'text', 'creator', 'date'];
      var invalids = answer.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }

      answer.save().then(function() {
        return success.OK(res);
      }, function() {
        return error.InternalServerError(res);
      });
    }, function() {
      return error.NotFound(res);
    });
  }
};
