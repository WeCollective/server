'use strict';

var express = require('express');
var router = express.Router();

var error = require('./routes/responses/errors.js');
var success = require('./routes/responses/successes.js');

// Middleware to ensure a user is logged in (used on protected routes)
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();
  return error.Forbidden(res);
};

module.exports = function(app, passport, dbClient) {

  // USER ROUTES
  var user = require('./routes/user.routes.js')(dbClient);
  // sign up
  router.route('/user')
    .post(function(req, res, next) {
      passport.authenticate('local-signup', function(err, user, info) {
        if (err) { return next(err); }
        if (!user) {
          return res.status(info.status).json({ message: info.message });
        }
        return success.OK(res);
      })(req, res, next);
    });
  // log in
  router.route('/user/login')
    .post(function(req, res, next) {
      passport.authenticate('local-login', function(err, user, info) {
        if (err) { return next(err); }
        if (!user) {
          return res.status(info.status).json({ message: info.message });
        }
        return success.OK(res);
      })(req, res, next);
    });
  // log out
  router.route('/user/logout')
    .get(function(req, res, next) {
      req.logout();
      return success.OK(res);
    });
  // get authenticated user
  router.route('/user/me')
    .get(isLoggedIn, user.getSelf);
  // get specified user
  router.route('/user/:username')
    .get(user.get);

  return router;
};
