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
          var status = 403;
          if(info.status) {
            status = info.status;
          }
          return res.status(status).json({ message: info.message });
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
    .delete(isLoggedIn, user.deleteSelf)
    .put(isLoggedIn, user.putSelf);
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
  // get presigned url for profile picture upload to S3
  router.route('/user/me/picture-upload-url')
    .get(isLoggedIn, function(req, res) {
      user.getPictureUploadUrl(req, res, 'picture');
    });
  // get presigned url for cover picture upload to S3
  router.route('/user/me/cover-upload-url')
    .get(isLoggedIn, function(req, res) {
      user.getPictureUploadUrl(req, res, 'cover');
    });
  // get authd user profile picture presigned url
  router.route('/user/me/picture')
    .get(isLoggedIn, function(req, res) {
      user.getOwnPicture(req, res, 'picture');
    });
  // get authd user cover picture presigned url
  router.route('/user/me/cover')
    .get(isLoggedIn, function(req, res) {
      user.getOwnPicture(req, res, 'cover');
    });
  // get user profile picture presigned url
  router.route('/user/:username/picture')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          user.getOwnPicture(req, res, 'picture');
        } else {
          user.getPicture(req, res, 'picture');
        }
      } else {
        user.getPicture(req, res, 'picture');
      }
    });
  // get user cover picture presigned url
  router.route('/user/:username/cover')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          user.getOwnPicture(req, res, 'cover');
        } else {
          user.getPicture(req, res, 'cover');
        }
      } else {
        user.getPicture(req, res, 'cover');
      }
    });

  // BRANCH ROUTES
  var branch = require('./routes/branch.routes.js');
  router.route('/branch')
    .post(isLoggedIn, branch.postBranch);
  router.route('/branch/:branchid')
    .get(branch.getBranch)
    .put(isLoggedIn, branch.putBranch);
  // get presigned url for branch profile picture upload to S3
  router.route('/branch/:branchid/picture-upload-url')
    .get(isLoggedIn, function(req, res) {
      branch.getPictureUploadUrl(req, res, 'picture');
    });
  // get presigned url for branch cover picture upload to S3
  router.route('/branch/:branchid/cover-upload-url')
    .get(isLoggedIn, function(req, res) {
      branch.getPictureUploadUrl(req, res, 'cover');
    });
  // get branch profile picture presigned url
  router.route('/branch/:branchid/picture')
    .get(function(req, res) {
      branch.getPicture(req, res, 'picture');
    });
  // get branch cover picture presigned url
  router.route('/branch/:branchid/cover')
    .get(function(req, res) {
      branch.getPicture(req, res, 'cover');
    });
  router.route('/subbranches/:parentid')
    .get(branch.getSubbranches);

  return router;
};
