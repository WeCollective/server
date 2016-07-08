'use strict';

var express = require('express');
var router = express.Router();

var error = require('./routes/responses/errors.js');
var success = require('./routes/responses/successes.js');

var ACL = require('./config/acl.js');

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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), user.get)
    .delete(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), user.delete)
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), user.put);
  // operations on a specified user
  router.route('/user/:username')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        user.get(req, res);
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        user.get(req, res);
      }
    });
  // get presigned url for profile picture upload to S3
  router.route('/user/me/picture-upload-url')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      user.getPictureUploadUrl(req, res, 'picture');
    });
  // get presigned url for cover picture upload to S3
  router.route('/user/me/cover-upload-url')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      user.getPictureUploadUrl(req, res, 'cover');
    });
  // get authd user profile picture presigned url
  router.route('/user/me/picture')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      user.getPicture(req, res, 'picture');
    });
  // get authd user cover picture presigned url
  router.route('/user/me/cover')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      user.getPicture(req, res, 'cover');
    });
  // get user profile picture presigned url
  router.route('/user/:username/picture')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        user.getPicture(req, res, 'picture');
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        user.getPicture(req, res, 'picture');
      }
    });
  // get user cover picture presigned url
  router.route('/user/:username/cover')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        user.getPicture(req, res, 'cover');
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        user.getPicture(req, res, 'cover');
      }
    });

  // BRANCH ROUTES
  var branch = require('./routes/branch.routes.js');
  router.route('/branch')
    .post(ACL.validateRole(ACL.Roles.AuthenticatedUser), branch.post);
  router.route('/branch/:branchid')
    .get(branch.get)
    .put(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, branch.put);
  // get presigned url for branch profile picture upload to S3
  router.route('/branch/:branchid/picture-upload-url')
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, function(req, res) {
      branch.getPictureUploadUrl(req, res, 'picture');
    });
  // get presigned url for branch cover picture upload to S3
  router.route('/branch/:branchid/cover-upload-url')
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, function(req, res) {
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

  // TODO change to /branch/:branchid/subbranches
  router.route('/subbranches/:parentid')
    .get(branch.getSubbranches);

  return router;
};
