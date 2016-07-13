'use strict';

var express = require('express');
var router = express.Router();
var success = require('../../responses/successes.js');
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./user.controller.js');

  // sign up
  router.route('/')
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
  router.route('/login')
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
  router.route('/logout')
    .get(function(req, res, next) {
      req.logout();
      return success.OK(res);
    });

  // operations on the authenticated user
  router.route('/me')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.get)
    .delete(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.delete)
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.put);

  // operations on a specified user
  router.route('/:username')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.get(req, res);
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.get(req, res);
      }
    });

  // get presigned url for profile picture upload to S3
  router.route('/me/picture-upload-url')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPictureUploadUrl(req, res, 'picture');
    });
  // get presigned url for cover picture upload to S3
  router.route('/me/cover-upload-url')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPictureUploadUrl(req, res, 'cover');
    });
  // get authd user profile picture presigned url
  router.route('/me/picture')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPicture(req, res, 'picture');
    });
  // get authd user cover picture presigned url
  router.route('/me/cover')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPicture(req, res, 'cover');
    });
  // get user profile picture presigned url
  router.route('/:username/picture')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.getPicture(req, res, 'picture');
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'picture');
      }
    });
  // get user cover picture presigned url
  router.route('/:username/cover')
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.getPicture(req, res, 'cover');
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'cover');
      }
    });

  return router;
};
