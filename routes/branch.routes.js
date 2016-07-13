'use strict';

var aws = require('../config/aws.js');
var fs = require('../config/filestorage.js');

var Branch = require('../models/branch.model.js');
var BranchImage = require('../models/branch-image.model.js');
var Mod = require('../models/mod.model.js');
var User = require('../models/user.model.js');
var ModLogEntry = require('../models/mod-log-entry.model.js');
var success = require('./responses/successes.js');
var error = require('./responses/errors.js');

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
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // check whether the specified branch id is unique
    new Branch().findById(req.body.id).then(function() {
      return error.BadRequest(res, 'That Unique Name is already taken');
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }

      // TODO: check whether parentid exists

      // create branch object
      var time = new Date().getTime();
      var branch = new Branch({
        id: req.body.id,
        name: req.body.name,
        creator: req.user.username,
        date: time,
        parentid: req.body.parentid
      });

      // validate branch properties
      var propertiesToCheck = ['id', 'name', 'creator', 'date', 'parentid'];
      var invalids = branch.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }

      // create mod object
      var mod = new Mod({
        branchid: req.body.id,
        date: time,
        username: req.user.username
      });

      // validate mod properties
      propertiesToCheck = ['branchid', 'date', 'username'];
      invalids = mod.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }

      branch.save().then(function() {
        mod.save().then(function () {
          return success.OK(res);
        }, function() {
          return error.InternalServerError(res);
        });
      }, function() {
        return error.InternalServerError(res);
      });
    });
  },
  get: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var branch = new Branch();
    branch.findById(req.params.branchid).then(function() {
      return success.OK(res, branch.data);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  put: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var branch = new Branch({
      id: req.params.branchid
    });

    var propertiesToCheck = [];
    if(req.body.name) {
      branch.set('name', req.body.name);
      propertiesToCheck.push('name');
    }

    if(req.body.description) {
      branch.set('description', req.body.description);
      propertiesToCheck.push('description');
    }

    if(req.body.rules) {
      branch.set('rules', req.body.rules);
      propertiesToCheck.push('rules');
    }

    // Check new parameters are valid, ignoring id validity
    var invalids = branch.validate(propertiesToCheck);

    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }
    branch.update().then(function() {
      return success.OK(res);
    }, function() {
      return error.InternalServerError(res);
    });
  },
  getPictureUploadUrl: function(req, res, type) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(type != 'picture' && type != 'cover') {
      return error.InternalServerError(res);
    }

    var filename = req.params.branchid + '-' + type + '-orig.jpg';
    var params = {
      Bucket: fs.Bucket.BranchImages,
      Key: filename,
      ContentType: 'image/*'
    }
    var url = aws.s3Client.getSignedUrl('putObject', params, function(err, url) {
      return success.OK(res, url);
    });
  },
  getPicture: function(req, res, type) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(type != 'picture' && type != 'cover') {
      return error.InternalServerError(res);
    }
    var size;
    if(type == 'picture') {
      size = 500;
    } else {
      size = 1280;
    }

    var image = new BranchImage();
    image.findById(req.params.branchid, type).then(function() {
      aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.BranchImagesResized,
        Key: image.data.id + '-' + size + '.' + image.data.extension
      }, function(err, url) {
        if(err) {
          return error.InternalServerError(res);
        }
        return success.OK(res, url);
      });
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getMods: function(req, res) {
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
  postMod: function(req, res) {
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
    user.findByUsername(req.body.username).then(function() {
      // check user is not already a mod on this branch
      var checkMod = new Mod();
      checkMod.findByBranch(req.params.branchid).then(function(mods) {
        if(!mods) {
          console.error("Error fetching mods.");
          return error.InternalServerError(res);
        }
        // check if the specified user is in the branch's mod list
        for(var i = 0; i < mods.length; i++) {
          if(mods[i].username == req.body.username) {
            return error.BadRequest(res, 'User is already a moderator');
          }
        }
        // safe to add this user as a new mod
        mod.save().then(function() {
          return postModLogEntry(req, res, 'addmod', mod.data.username);
        }).then(function () {
          return success.OK(res);
        }).catch(function () {
          console.error("Error saving new moderator.");
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
  deleteMod: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(!req.params.username) {
      return error.BadRequest(res, 'Missing username');
    }

    // create new mod object
    var mod = new Mod();
    mod.findByBranch(req.params.branchid).then(function(mods) {
      var deleter = {}; // user performing the delete
      var deletee = {}; // mod to be deleted
      for(var i = 0; i < mods.length; i++) {
        if(mods[i].username == req.user.username) {
          deleter = mods[i];
        }
        if(mods[i].username == req.params.username) {
          deletee = mods[i];
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
        return success.OK(res);
      }).catch(function(err) {
        console.error("Error deleting mod.");
        return error.InternalServerError(res);
      });
    }, function() {
      console.error("Error fetching mods.");
      return error.InternalServerError(res);
    });
  },
  getSubbranches: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var branch = new Branch();
    branch.findSubbranches(req.params.branchid).then(function(data) {
      return success.OK(res, data);
    }, function() {
      return error.InternalServerError(res);
    });
  },
  getModLog: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var log = new ModLogEntry();
    log.findByBranch(req.params.branchid).then(function(data) {
      return success.OK(res, data);
    }, function(err) {
      if(err) {
        console.error("Error fetching mod log.");
        console.log(err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
