const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const error = reqlib('responses/errors');
const mailer = reqlib('config/mailer');
const Models = reqlib('models/');
const NotificationTypes = reqlib('config/notification-types');
const success = reqlib('responses/successes');

const { createNotificationId } = Constants.Helpers;

module.exports.addModerator = (req, res) => {
  const { branchid } = req.params;
  const { username } = req.body;
  const date = new Date().getTime();
  const userUsername = req.user.get('username');
  let branchMods = [];
  let user;

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  if (!username) {
    return error.BadRequest(res, 'Invalid username.');
  }

  // The added user must be a real user and cannot be a moderator
  // on this branch already.
  return Models.User.findOne({
    where: {
      username,
    },
  })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'User does not exist.',
          status: 403,
        });
      }

      user = instance;

      return Models.Branch.findById(branchid);
    })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Branch does not exist.',
          status: 403,
        });
      }
      return Models.Mod.findByBranch(branchid);
    })
    .then(mods => {
      if (!mods.length) {
        return Promise.reject({
          message: `Branch ${branchid} has no moderators.`,
          status: 403,
        });
      }

      branchMods = mods;

      // check if the specified user is in the branch's mod list
      for (let i = 0; i < branchMods.length; i += 1) {
        if (branchMods[i].get('username') === username) {
          return Promise.reject({
            message: `${username} is already a moderator of ${branchid}.`,
            status: 403,
          });
        }
      }

      // Add the new moderator.
      return Models.Mod.create({
        branchid,
        date,
        username,
      });
    })
    .then(instance => {
      // Append user to the moderators list so he receives a notification.
      branchMods = [
        ...branchMods,
        instance,
      ];

      return Models.ModLog.create({
        action: 'addmod',
        branchid,
        data: username,
        date,
        username: userUsername,
      });
    })
    // Notify branch moderators there is a new moderator.
    .then(() => {    
      let promises = [];

      // Notify everyone but ourselves.
      for (let i = 0; i < branchMods.length; i += 1) {
        const modUsername = branchMods[i].get('username');
        if (modUsername !== userUsername) {
          const promise = Models.Notification.create({
            data: {
              action: 'add',
              branchid,
              mod: username,
              username: userUsername,
            },
            date,
            id: createNotificationId(modUsername, date),
            type: NotificationTypes.MODERATOR,
            unread: true,
            user: modUsername,
          });

          promises = [
            ...promises,
            promise,
          ];
        }
      }

      return Promise.all(promises);
    })
    // Increment the added user's moderator count.
    .then(() => {
      user.set('num_mod_positions', user.get('num_mod_positions') + 1);
      return user.update();
    })
    // update the SendGrid contact list with the new user data
    // todo
    .then(() => mailer.addContact(user.dataValues, true))
    .then(() => success.OK(res))
    .catch(err => {
      console.error('Error adding a moderator:', err);
      return error.code(res, err.status, err.message);
    });
};

module.exports.get = (req, res) => {
  const { branchid } = req.params;

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  return Models.Mod.findByBranch(branchid)
    .then(mods => success.OK(res, mods.map(instance => ({
      branchid: instance.get('branchid'),
      date: instance.get('date'),
      username: instance.get('username'),
    }))))
    .catch(err => {
      if (err) {
        console.error('Error fetching mods.');
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
};

module.exports.removeModerator = (req, res) => {
  const {
    branchid,
    username,
  } = req.params;
  const date = new Date().getTime();
  const userUsername = req.user.get('username');
  let branchMods = [];
  let mod;
  let user;
  let userMod;

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  if (!username) {
    return error.BadRequest(res, 'Invalid username.');
  }

  return Models.Mod.findByBranch(branchid)
    .then(mods => {
      if (!mods.length) {
        return Promise.reject({
          message: `Branch ${branchid} has no moderators.`,
          status: 404,
        });
      }

      branchMods = mods;

      for (let i = 0; i < branchMods.length; i += 1) {
        const modUsername = branchMods[i].get('username');

        if (modUsername == userUsername) {
          userMod = branchMods[i];
          if (mod) break;
        }

        if (modUsername == username) {
          mod = branchMods[i];
          if (userMod) break;
        }
      }

      if (!userMod) {
        return Promise.reject({
          message: `You are not a moderator of ${branchid}.`,
          status: 403,
        });
      }

      if (!mod) {
        return Promise.reject({
          message: `${username} is not a moderator of ${branchid}.`,
          status: 403,
        });
      }

      // We cannot delete moderators who held this position before us.
      if (Number.parseInt(mod.get('date'), 10) < Number.parseInt(userMod.get('date'), 10)) {
        return Promise.reject({
          message: 'You cannot remove moderators who became moderators before you.',
          status: 403,
        });
      }

      // Create the log entry first because destroying the instance would
      // remove the entry from the array too. We cannot copy the object since
      // the instance methods are non-enumerable.
      return Models.ModLog.create({
        action: 'removemod',
        branchid,
        data: username,
        date,
        username: userUsername,
      });
    })
    // Notify other branch moderators that a moderator was removed.
    .then(() => {
      let promises = [];

      // Notify everyone but ourselves.
      for (let i = 0; i < branchMods.length; i += 1) {
        const modUsername = branchMods[i].get('username');
        if (modUsername !== userUsername) {
          const promise = Models.Notification.create({
            data: {
              action: 'remove',
              branchid,
              mod: username,
              username: userUsername,
            },
            date,
            id: createNotificationId(modUsername, date),
            type: NotificationTypes.MODERATOR,
            unread: true,
            user: modUsername,
          });

          promises = [
            ...promises,
            promise,
          ];
        }
      }

      return Promise.all(promises);
    })
    .then(() => mod.destroy())
    // Decrement the removed user's moderator count.
    .then(() => Models.User.findOne({
      where: {
        username,
      },
    }))
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'User does not exist.',
          status: 404,
        });
      }

      user = instance;
      user.set('num_mod_positions', user.get('num_mod_positions') - 1);
      return user.update();
    })
    // update the SendGrid contact list with the new user data
    // todo
    .then(() => mailer.addContact(user.dataValues, true))
    .then(() => success.OK(res))
    .catch(err => {
      console.error('Error removing a moderator:', err);
      return error.code(res, err.status, err.message);
    });
};
