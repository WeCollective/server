'use strict';

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

var Post = require('../../models/post.model.js');
var PollAnswer = require('../../models/poll-answer.model.js');
var UserVote = require('../../models/user-vote.model.js');

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
  },
  get: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var sortBy = req.query.sortBy;
    if(!req.query.sortBy) {
      sortBy = 'date';
    }

    // if lastAnswerId is specified, client wants results which appear _after_ this answer (pagination)
    var lastAnswer;
    new Promise(function(resolve, reject) {
      if(req.query.lastAnswerId) {
        var answer = new PollAnswer();
        // get the post
        answer.findById(req.query.lastAnswerId).then(function() {
          // create lastAnswer object
          lastAnswer = answer.data;
          resolve();
        }).catch(function(err) {
          if(err) reject();
          return error.NotFound(res); // lastAnswerId is invalid
        });
      } else {
        // no last answer specified, continue
        resolve();
      }
    }).then(function() {
      return new PollAnswer().findByPost(req.params.postid, sortBy, lastAnswer);
    }).then(function(answers) {
      if(!answers || answers.length == 0) {
        return error.NotFound(res);
      }
      return success.OK(res, answers);
    }).catch(function(err) {
      if(err) {
        console.error("Error fetching post data: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  votePoll: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }
    if(!req.params.answerid) {
      return error.BadRequest(res, 'Missing answerid');
    }

    if(req.body.vote !== 'up') {
      return error.BadRequest(res, 'Missing or malformed vote parameter');
    }

    var updatedAnswer = new PollAnswer();
    updatedAnswer.findById(req.params.answerid).then(function() {
      if(updatedAnswer.data.postid !== req.params.postid) {
        return error.NotFound(res);
      }

      var uservote = new UserVote();
      return uservote.findByUsernameAndItemId(req.user.username, 'poll-' + req.params.postid);
    }, function () {
      return error.NotFound(res);
    }).then(function () {
      // user has voted on this poll before
      return error.BadRequest(res, 'User has already voted on this poll');
    }, function () {
      // user has not voted on this poll before
      updatedAnswer.set('votes', updatedAnswer.data.votes + 1);
      return updatedAnswer.update();
    }).then(function (response) {
      var vote = new UserVote({
        username: req.user.username,
        itemid: 'poll-' + req.params.postid,
        direction: req.body.vote
      });
      return vote.save();
    }).then(function () {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error voting on poll answer: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
