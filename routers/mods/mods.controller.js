'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var NotificationTypes = require('../../config/notification-types.js');
var mailer = require('../../config/mailer.js');

var Mod = require('../../models/mod.model.js');
var User = require('../../models/user.model.js');
var ModLogEntry = require('../../models/mod-log-entry.model.js');
var Notification = require('../../models/notification.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

function postModLogEntry(req, res, action, data) {
  return new Promise(function(resolve, reject) {
    var entry = new ModLogEntry({
      branchid: req.params.branchid,
      username: req.user.username,
      date: new Date().getTime(),
      action: action,
      data: data
    });

    var propertiesToCheck = ['branchid', 'username', 'date', 'action', 'data'];
    var invalids = entry.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return reject();
    }
    entry.save().then(resolve, reject);
  });
}

module.exports = {
  post: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    // create new mod object
    var mod = new Mod({
      branchid: req.params.branchid,
      date: new Date().getTime(),
      username: req.body.username
    });

    // validate new mod
    var propertiesToCheck = ['branchid', 'date', 'username'];
    var invalids = mod.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // check username is a real user
    var user = new User();
    var branchMods;
    user.findByUsername(req.body.username).then(function() {
      // check user is not already a mod on this branch
      var checkMod = new Mod();
      checkMod.findByBranch(req.params.branchid).then(function(mods) {
        if(!mods) {
          console.error("Error fetching mods.");
          return error.InternalServerError(res);
        }
        branchMods = mods;
        // check if the specified user is in the branch's mod list
        for(var i = 0; i < branchMods.length; i++) {
          if(branchMods[i].username == req.body.username) {
            return error.BadRequest(res, 'User is already a moderator');
          }
        }
        // safe to add this user as a new mod
        mod.save().then(function() {
          return postModLogEntry(req, res, 'addmod', mod.data.username);
        }).then(function () {
          // notify mods of the branch that a mod was added
          var promises = [];
          var time = new Date().getTime();
          branchMods.push(mod.data);  // add the new mod to the notification recipient list
          // do not notify self that you added a moderator
          for(var i = 0; i < branchMods.length; i++) {
            if(branchMods[i].username == req.user.username) {
              branchMods.splice(i, 1);
            }
          }
          for(var i = 0; i < branchMods.length; i++) {
            var notification = new Notification({
              id: branchMods[i].username + '-' + time,
              user: branchMods[i].username,
              date: time,
              unread: true,
              type: NotificationTypes.MODERATOR,
              data: {
                action: 'add',
                branchid: req.params.branchid,
                username: req.user.username,
                mod: req.body.username
              }
            });

            var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
            var invalids = notification.validate(propertiesToCheck);
            if(invalids.length > 0) {
              console.error('Error creating notification.');
              return error.InternalServerError(res);
            }
            promises.push(notification.save(req.sessionID));
          }
          return Promise.all(promises);
        }).then(function () {
          // increment the user's mod count
          user.set('num_mod_positions', user.data.num_mod_positions + 1);
          return user.update();
        }).then(function () {
          // update the SendGrid contact list with the new user data
          return mailer.addContact(user.data, true);
        }).then(function() {
          return success.OK(res);
        }).catch(function(err) {
          console.error("Error saving new moderator: ", err);
          return error.InternalServerError(res);
        });
      }, function() {
        // either an error, or no mods found; should be at least one!
        console.error("Error fetching mods.");
        return error.InternalServerError(res);
      });
    }, function(err) {
      if(err) {
        console.error("Error fetching user.");
        return error.InternalServerError(res);
      }
      // user doesn't exist
      return error.NotFound(res);
    });
  },
  get: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var mods = new Mod();
    mods.findByBranch(req.params.branchid).then(function(response) {
      return success.OK(res, response);
    }, function(err) {
      if(err) {
        console.error("Error fetching mods.");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  delete: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(!req.params.username) {
      return error.BadRequest(res, 'Missing username');
    }

    // create new mod object
    var mod = new Mod();
    var branchMods;
    var deleter = {}; // user performing the delete
    var deletee = {}; // mod to be deleted
    var deleteeUser = new User();
    mod.findByBranch(req.params.branchid).then(function(mods) {
      branchMods = mods;
      for(var i = 0; i < branchMods.length; i++) {
        if(branchMods[i].username == req.user.username) {
          deleter = branchMods[i];
        }
        if(branchMods[i].username == req.params.username) {
          deletee = branchMods[i];
        }
      }

      // deletee must have become a mod after the deleter did
      if(Number(deleter.date) > Number(deletee.date)) {
        return error.Forbidden(res);
      }

      deletee = new Mod(deletee);
      deletee.delete({
        branchid: deletee.data.branchid,
        date: Number(deletee.data.date)
      }).then(function () {
        return postModLogEntry(req, res, 'removemod', req.params.username);
      }).then(function () {
        // notify mods of the branch that a mod was removed
        var promises = [];
        var time = new Date().getTime();
        // add the deleted mod to the notification recipient list
        branchMods.push({ username: req.params.username });
        // do not notify self that you added a moderator
        for(var i = 0; i < branchMods.length; i++) {
          if(branchMods[i].username == req.user.username) {
            branchMods.splice(i, 1);
          }
        }
        for(var i = 0; i < branchMods.length; i++) {
          var notification = new Notification({
            id: branchMods[i].username + '-' + time,
            user: branchMods[i].username,
            date: time,
            unread: true,
            type: NotificationTypes.MODERATOR,
            data: {
              action: 'remove',
              branchid: req.params.branchid,
              username: req.user.username,
              mod: req.params.username
            }
          });

          var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
          var invalids = notification.validate(propertiesToCheck);
          if(invalids.length > 0) {
            console.error('Error creating notification: invalid ' + invalids[0]);
            return error.InternalServerError(res);
          }
          promises.push(notification.save(req.sessionID));
        }
        return Promise.all(promises);
      }).then(function () {
        // get the deleted mod user
        return deleteeUser.findByUsername(req.params.username);
      }).then(function () {
        // decrement the deleted mod's mod count
        deleteeUser.set('num_mod_positions', deleteeUser.data.num_mod_positions - 1);
        return deleteeUser.update();
      }).then(function () {
        // update the SendGrid contact list with the new user data
        return mailer.addContact(deleteeUser.data, true);
      }).then(function() {
        return success.OK(res);
      }).catch(function(err) {
        console.error("Error deleting mod: ", err);
        return error.InternalServerError(res);
      });
    }, function() {
      console.error("Error fetching mods: ", err);
      return error.InternalServerError(res);
    });
  }
};
