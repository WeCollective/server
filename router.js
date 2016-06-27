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
    .post(function(req, res, next) {
      // local-signup with override of done() method to access info object from passport strategy
      passport.authenticate('local-signup', function(err, user, info) {
        if (err) { return next(err); }
        // if no user object, send error response
        if (!user) {
          return res.status(info.status).json({ message: info.message });
        }
        // manually log in user to establish session
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          return success.OK(res);
        });
      })(req, res, next);
    });
  // log in
  router.route('/user/login')
    .post(function(req, res, next) {
      // local-login with override of done() method to access info object from passport strategy
      passport.authenticate('local-login', function(err, user, info) {
        if (err) { return next(err); }
        // if no user object, send error response
        if (!user) {
          return res.status(info.status).json({ message: info.message });
        }
        // manually log in user to establish session
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          return success.OK(res);
        });
      })(req, res, next);
    });
  // log out
  router.route('/user/logout')
    .get(function(req, res, next) {
      req.logout();
      return success.OK(res);
    });
  // operations on the authenticated user
  router.route('/user/me')
    .get(isLoggedIn, user.getSelf)
    .delete(isLoggedIn, user.deleteSelf);
  // operations on a specified user
  router.route('/user/:username')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          user.getSelf(req, res);
        } else {
          user.get(req, res);
        }
      } else {
        user.get(req, res);
      }
    });

  return router;
};
