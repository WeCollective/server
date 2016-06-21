'use strict';

var express = require('express');
var router = express.Router();

var error = require('./routes/responses/errors.js');

// Middleware to ensure a user is logged in (used on protected routes)
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();
  return error.Forbidden(res);
};

module.exports = function(app, passport) {
  var user = require('./routes/user.routes.js');
  router.route('/user')
    .post(passport.authenticate('local-signup'), function(req, res, next) {
      console.log("Success!");
      res.send("SIGNED UP!");
    });
  router.route('/user/login')
    .post(passport.authenticate('local-login'), function(req, res, next) {
      console.log("Success!");
      res.send("LOGGED IN!");
    });

  return router;
};
