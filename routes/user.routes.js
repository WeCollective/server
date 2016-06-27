'use strict';

var db = require('../config/database.js');
var User = require('../models/user.model.js');
var success = require('./responses/successes.js');
var error = require('./responses/errors.js');

module.exports = {
  // TODO: access controls on what user info is sent back, inc. yourself vs other users
  getSelf: function(req, res) {
    // no user object attached by passport
    if(!req.user.username) {
      return error.InternalServerError(res);
    }

    var user = new User();
    user.findByUsername(req.user.username).then(function() {
      var userResponse = {
        username: user.data.username,
        name: {
          first: user.data.firstname,
          last: user.data.lastname
        },
        email: user.data.email
      };
      return success.OK(res, userResponse);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  get:  function(req, res) {
    // no username parameter
    if(!req.params.username) {
      return error.BadRequest(res);
    }

    var user = new User();
    user.findByUsername(req.params.username).then(function() {
      var userResponse = {
        username: user.data.username,
        name: {
          first: user.data.firstname,
          last: user.data.lastname
        }
      };
      return success.OK(res, userResponse);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  deleteSelf: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    var user = new User({
      username: req.user.username
    });
    user.delete().then(function() {
      req.logout();
      return success.OK(res);
    }, function() {
      console.error('Error deleting user from database.');
      return error.InternalServerError(res);
    });
  }
};
