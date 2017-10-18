const _ = require('lodash');
const Branch = require('../models/branch.model');
const error = require('../responses/errors');
const Mod = require('../models/mod.model');

const ACL = {};

/**
 * @apiDefine guest Guest access
 * Anyone can access this route, without authentication.
 */
/**
 * @apiDefine auth User access
 * All authenticated users can access this route.
 */
/**
 * @apiDefine self Self access
 * Only authenticated users can access themselves on this route.
 */
/**
 * @apiDefine mod Mod access
 * Only authenticated moderators of the specified branch can access this route.
 */
/**
 * @apiDefine admin Admin access
 * Only authenticated site administrators can access this route (moderators of the root branch).
 */
ACL.Roles = {
  Guest: 0,
  AuthenticatedUser: 1,
  Self: 2,
  Moderator: 3,
  Admin: 4
};

ACL.Schema = (role, model) => {
  if ('User' === model) {
    switch (role) {
      case ACL.Roles.Guest:
      case ACL.Roles.AuthenticatedUser:
        return {
          datejoined: null,
          dob: null,
          name: null,
          num_branches: null,
          num_comments: null,
          num_mod_positions: null,
          num_posts: null,
          username: null,
        };

      case ACL.Roles.Self:
        return {
          datejoined: null,
          dob: null,
          email: null,
          name: null,
          num_branches: null,
          num_comments: null,
          num_mod_positions: null,
          num_posts: null,
          show_nsfw: null,
          username: null,
        };

      default:
        return {};
    }
  }

  return {};
};

// Middleware to ensure a user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    req.ACLRole = ACL.Roles.AuthenticatedUser;
    return next();
  }
  
  return error.Forbidden(res);
};

// Middleware to ensure a user is logged in as the specified user
const isLoggedInAsSelf = (req, res, next, username) => {
  if (req.isAuthenticated() && req.user.username === username) {
    req.ACLRole = ACL.Roles.Self;
    return next();
  }

  return error.Forbidden(res);
};

// Attach the specified role to the request body if the role's conditions are met
ACL.validateRole = (role, resourceId, customError) => {
  return (req, res, next) => {
    const mod = new Mod();

    switch(role) {
      // Anyone can be a Guest
      case ACL.Roles.Guest:
        req.ACLRole = ACL.Roles.Guest;
        next();
        break;

      // AuthenticatedUser must be logged in
      case ACL.Roles.AuthenticatedUser:
        isLoggedIn(req, res, next);
        break;

      // Self must be logged in with username matching the provided param
      case ACL.Roles.Self:
        isLoggedInAsSelf(req, res, next, resourceId);
        break;

      // Moderator must be logged in
      case ACL.Roles.Moderator:
        if (!req.isAuthenticated()) {
          return error.Forbidden(res);
        }

        // Moderator must be one of the mods of the specified branch
        mod.findByBranch(resourceId)
          .then(mods => {
            if (!mods) {
              console.error('No mods object received.');
              return error.InternalServerError(res);
            }

            for (let i = 0; i < mods.length; i += 1) {
              if (mods[i].username == req.user.username) {
                req.ACLRole = ACL.Roles.Moderator;
                return next();
              }
            }

            if (customError && typeof customError === 'object') {
              return error.code(res, customError.code, customError.message);
            }

            return error.Forbidden(res);
          })
          .catch(err => {
            if (err) {
              console.error('Error fetching branch mods:', err);
              return error.InternalServerError(res);
            }

            return error.NotFound(res);
          });
        break;

      case ACL.Roles.Admin:
        // Admin must be logged in.
        if (!req.isAuthenticated()) {
          return error.Forbidden(res);
        }

        // Admin is a moderator of the root branch
        mod.findByBranch('root')
          .then(mods => {
            if (!mods) {
              console.error('No mods object received.');
              return error.InternalServerError(res);
            }
            
            for (let i = 0; i < mods.length; i += 1) {
              if (mods[i].username == req.user.username) {
                req.ACLRole = ACL.Roles.Admin;
                return next();
              }
            }

            return error.Forbidden(res);
          })
          .catch(err => {
            if (err) {
              console.error('Error fetching branch mods:', err);
              return error.InternalServerError(res);
            }

            return error.NotFound(res);
          });
        break;

      default:
        console.error('Unknown ACL Role');
        return;
    }
  };
};

// Forcibly attach a role to the request body without performing checks
ACL.attachRole = role => {
  return (req, res, next) => {
    req.ACLRole = role;
    if (next) {
      next();
    }
  };
};

module.exports = ACL;
