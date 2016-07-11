'use strict';

var _ = require('lodash');
var Branch = require('../models/branch.model.js');
var Mod = require('../models/mod.model.js');
var error = require('../routes/responses/errors.js');

var ACL = {};

ACL.Roles = {
  Guest: 0,
  AuthenticatedUser: 1,
  Self: 2,
  Moderator: 3,
  Admin: 4
};

ACL.Schema = function(role, model) {
  if(model === 'User') {
    switch(role) {
      case ACL.Roles.Guest:
      case ACL.Roles.AuthenticatedUser:
        return {
          username: null,
          firstname: null,
          lastname: null,
          dob: null,
          datejoined: null
        };
        break;
      case ACL.Roles.Self:
        return {
          username: null,
          email: null,
          firstname: null,
          lastname: null,
          dob: null,
          datejoined: null
        };
        break;
      default:
        return {};
    }
  } else {
    return {};
  }
};

// Middleware to ensure a user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    req.ACLRole = ACL.Roles.AuthenticatedUser;
    return next();
  }
  return error.Forbidden(res);
};

// Middleware to ensure a user is logged in as the specified user
function isLoggedInAsSelf(req, res, next, username) {
  if (req.isAuthenticated() && req.user.username === username)
    req.ACLRole = ACL.Roles.Self;
    return next();
  return error.Forbidden(res);
};

// Attach the specified role to the request body if the role's conditions are met
ACL.validateRole = function(role, resourceId) {
  return function(req, res, next) {
    switch(role) {
      case ACL.Roles.Guest:
        // anyone can be a Guest
        req.ACLRole = ACL.Roles.Guest;
        next();
        break;
      case ACL.Roles.AuthenticatedUser:
        // AuthenticatedUser must be logged in
        isLoggedIn(req, res, next);
        break;
      case ACL.Roles.Self:
        // Self must be logged in with username matching the provided param
        isLoggedInAsSelf(req, res, next, resourceId);
        break;
      case ACL.Roles.Moderator:
        // Moderator must be logged in
        if (!req.isAuthenticated()) {
          return error.Forbidden(res);
        }
        // Moderator must be one of the mods of the specified branch
        var mod = new Mod();
        mod.findByBranch(resourceId).then(function(mods) {
          if(!mods) {
            console.error("No mods object received.");
            return error.InternalServerError(res);
          }
          for(var i = 0; i < mods.length; i++) {
            if(mods[i].username == req.user.username) {
              req.ACLRole = ACL.Roles.Moderator;
              return next();
            }
          }
          return error.Forbidden(res);
        }, function(err) {
          if(err) {
            console.error('Error fetching branch mods.');
            return error.InternalServerError(res);
          }
          return error.NotFound(res);
        });

        var branch = new Branch();
        branch.findById(resourceId).then(function() {
          if(branch.data.mods.indexOf(req.user.username) > -1) {
            req.ACLRole = ACL.Roles.Moderator;
            next();
          } else {
            return error.Forbidden(res);
          }
        }, function(err) {
          if(err) {
            console.error('Error fetching branch.');
            return error.InternalServerError(res);
          }
          return error.NotFound(res);
        });
        break;
      default:
        console.error("Unknown ACL Role");
        return;
    }
  }
};

// Forcibly attach a role to the request body without performing checks
ACL.attachRole = function(role) {
  return function(req, res, next) {
    req.ACLRole = role;
    if(next) {
      next();
    }
  }
};

module.exports = ACL;
