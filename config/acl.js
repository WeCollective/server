const reqlib = require('app-root-path').require;

const error = reqlib('responses/errors');
const Models = reqlib('models/');

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
const Roles = {
  Guest: 0,
  AuthenticatedUser: 1,
  Self: 2,
  Moderator: 3,
  Admin: 4,
};

// Forcibly attach a role to the request body without performing checks
const attachRole = role => (req, res, next) => {
  req.ACLRole = role;
  if (next) next();
};

// Attach the specified role to the request body if the role's conditions are met
const validateRole = (role, resourceId, customError) => (req, res, next) => {
  switch(role) {
    // Anyone can be a Guest
    case Roles.Guest:
      req.ACLRole = Roles.Guest;
      return next();

    // AuthenticatedUser must be logged in
    case Roles.AuthenticatedUser: {
      if (!req.user) return error.Forbidden(res);
      req.ACLRole = Roles.AuthenticatedUser;
      return next();
    }

    // Self must be logged in with username matching the provided param
    case Roles.Self: {
      if (!req.user || req.user.get('username') !== resourceId) return error.Forbidden(res);
      req.ACLRole = Roles.Self;
      return next();
    }

    // Moderator must be logged in
    case Roles.Moderator:
      if (!req.isAuthenticated()) {
        return error.Forbidden(res);
      }

      if (!resourceId) {
        return error.InternalServerError(res);
      }

      // Moderator must be one of the mods of the specified branch
      return Models.Mod.findByBranch(resourceId)
        .then(instances => {
          if (!instances.length) {
            console.error('No mods object received.');
            return error.InternalServerError(res);
          }

          for (let i = 0; i < instances.length; i += 1) {
            if (instances[i].get('username') === req.user.get('username')) {
              req.ACLRole = Roles.Moderator;
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

    case Roles.Admin:
      // Admin must be logged in.
      if (!req.isAuthenticated()) {
        return error.Forbidden(res);
      }

      // Admin is a moderator of the root branch
      return Models.Mod.findByBranch('root')
        .then(instances => {
          if (!instances) {
            console.error('No mods object received.');
            return error.InternalServerError(res);
          }
            
          for (let i = 0; i < instances.length; i += 1) {
            if (instances[i].get('username') == req.user.get('username')) {
              req.ACLRole = Roles.Admin;
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

    default:
      throw new Error('Unknown ACL Role');
  }
};

module.exports = {
  attachRole,
  Roles,
  validateRole,
};
