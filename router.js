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

module.exports = function(app, passport) {

  // USER ROUTES
  var user = require('./routes/user.routes.js');
  // sign up
  router.route('/user')
    .post(passport.authenticate('local-signup'), function(req, res, next) {
      return success.OK(res);
    });
  // log in
  router.route('/user/login')
    .post(passport.authenticate('local-login'), function(req, res, next) {
      return success.OK(res);
    });
  // log out
  router.route('/user/logout')
    .get(function(req, res, next) {
      req.logout();
      return success.OK(res);
    });

  return router;
};
