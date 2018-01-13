const reqlib = require('app-root-path').require;

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
const roles = {
  Guest: 0,
  User: 1,
  Moderator: 2,
  Weco: 3,
};

const isMod = (username, branchid) => Models.Mod.findByBranch(branchid)
  .then(mods => {
    if (!mods.length) {
      console.error('No mods object received.');
      return Promise.reject({
        message: `b/${branchid} has no moderators.`,
        status: 403,
      });
    }

    for (let i = 0; i < mods.length; i += 1) {
      if (mods[i].get('username') === username) {
        return Promise.resolve();
      }
    }

    return Promise.reject({
      message: `You are not a moderator of b/${branchid}.`,
      status: 403,
    });
  })
  .catch(err => {
    console.error(`Cannot authenticate u/${username} as a moderator of b/${branchid}.`, err);
    return Promise.reject(err);
  });

// Middleware used to allow access to routes only to
// the users satisfying the minimum role criteria.
const allowAccess = (role, branchid) => (req, res, next) => {
  // No checks for guests.
  if (role === roles.Guest) {
    req.ACLRole = role;
    return next();
  }

  // Regular users must be authenticated and have approved profile.
  if (role === roles.User && req.user && req.user.get('verified')) {
    req.ACLRole = role;
    return next();
  }

  // Moderator must be one of the moderators of the specified branch.
  if (role === roles.Moderator && req.user && branchid) {
    return isMod(req.user.get('username'), branchid)
      .then(() => {
        req.ACLRole = role;
        return next();
      })
      .catch(err => {
        req.error = err;
        return next(JSON.stringify(req.error));
      });
  }

  // Global administratos must be authenticated and be mods of the root branch.
  if (role === roles.Weco && req.user) {
    return isMod(req.user.get('username'), 'root')
      .then(() => {
        req.ACLRole = role;
        return next();
      })
      .catch(err => {
        req.error = err;
        return next(JSON.stringify(req.error));
      });
  }

  return next(JSON.stringify(req.error));
};

module.exports = {
  allow: allowAccess,
  Roles: roles,
};
