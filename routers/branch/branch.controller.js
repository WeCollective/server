'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var mailer = require('../../config/mailer.js');

var Branch = require('../../models/branch.model.js');
var BranchImage = require('../../models/branch-image.model.js');
var Mod = require('../../models/mod.model.js');
var ModLogEntry = require('../../models/mod-log-entry.model.js');
var User = require('../../models/user.model.js');
var SubBranchRequest = require('../../models/subbranch-request.model.js');
var Tag = require('../../models/tag.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  post: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // create branch object
    var time = new Date().getTime();
    var branch = new Branch({
      id: req.body.id,
      name: req.body.name,
      creator: req.user.username,
      date: time,
      parentid: req.body.parentid,
      post_count: 0,
      post_points: 0,
      post_comments: 0
    });

    // validate branch properties
    var propertiesToCheck = ['id', 'name', 'creator', 'date', 'parentid'];
    var invalids = branch.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // check whether the specified branch id is unique
    new Branch().findById(req.body.id).then(function() {
      return error.BadRequest(res, 'That Unique Name is already taken');
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }

      var user = new User();
      // ensure the specified parent branch exists
      return new Branch().findById(req.body.parentid).then(function() {
        // save a subbranch request iff. the parentid is not the root branch
        if(req.body.parentid != 'root') {
          // create new subbranch request for the given parentid
          var subbranchRequest = new SubBranchRequest({
            parentid: req.body.parentid,
            childid: req.body.id,
            date: time,
            creator: req.user.username
          });
          // validate request properties
          var propertiesToCheck = ['parentid', 'childid', 'date', 'creator'];
          invalids = subbranchRequest.validate(propertiesToCheck);
          if(invalids.length > 0) {
            return error.BadRequest(res, 'Invalid ' + invalids[0]);
          }
          // save the request
          return subbranchRequest.save(req.sessionID);
        } else {
          return new Promise(function(resolve, reject) {
            resolve();
          });
        }
      }).then(function() {
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

        // save the mod of new branch
        return mod.save();
      }).then(function() {
        // save the new branch
        branch.set('parentid', 'root');
        return branch.save();
      }).then(function () {
        // add the branchid to the tags table with the tags of itself and
        // those of its parent (just 'root')
        var branchTag = new Tag({
          branchid: branch.data.id,
          tag: branch.data.id
        });
        propertiesToCheck = ['branchid', 'tag'];
        invalids = branchTag.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }
        return branchTag.save();
      }).then(function () {
        var rootTag = new Tag({
          branchid: branch.data.id,
          tag: 'root'
        });
        propertiesToCheck = ['branchid', 'tag'];
        invalids = rootTag.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }
        return rootTag.save();
      }).then(function () {
        // get the user
        return user.findByUsername(req.user.username);
      }).then(function () {
        // increment the user's branch and mod count
        user.set('num_branches', user.data.num_branches + 1);
        user.set('num_mod_positions', user.data.num_mod_positions + 1);
        return user.update();
      }).then(function () {
        // update the SendGrid contact list with the new user data
        return mailer.addContact(user.data, true);
      }).then(function() {
        return success.OK(res);
      }).catch(function() {
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
  delete: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var branch = new Branch();
    var profile = new BranchImage();
    var cover = new BranchImage();
    branch.findById(req.params.branchid).then(function() {
      // ensure the branch is a root branch
      if(branch.data.parentid != 'root') {
        return error.BadRequest(res, 'Branch must be a root branch');
      }
      // delete the branch
      return branch.delete({
        id: req.params.branchid
      });
    }, function(err) {
      if(err) return error.InternalServerError(res);
      // no err, branch was not found
      return error.NotFound(res);
    }).then(function() {
      // get branch profile picture
      return new Promise(function(resolve, reject) {
        profile.findById(req.params.branchid, 'picture').then(resolve, function(err) {
          if(err) return reject();
          resolve();
        });
      });
    }).then(function () {
      // get branch cover picture
      return new Promise(function(resolve, reject) {
        profile.findById(req.params.branchid, 'cover').then(resolve, function(err) {
          if(err) return reject();
          resolve();
        });
      });
    }).then(function() {
      // delete orig branch profile and cover pictures from s3
      return new Promise(function(resolve, reject) {
        var objects = [];
        if(profile.data.id) {
          objects.push({
            Key: profile.data.id + '-orig.' + profile.data.extension
          });
        }
        if(cover.data.id) {
          objects.push({
            Key: cover.data.id + '-orig.' + cover.data.extension
          });
        }
        if(objects.length == 0) {
          return resolve();
        }
        aws.s3Client.deleteObjects({
          Bucket: fs.Bucket.BranchImages,
          Delete: {
            Objects: objects
          }
        }, function(err) {
          if(err) return reject(err);
          resolve();
        });
      });
    }).then(function() {
      // delete resized branch profile and cover pictures from s3
      return new Promise(function(resolve, reject) {
        var objects = [];
        if(profile.data.id) {
          objects.push({
            Key: profile.data.id + '-640.' + profile.data.extension
          });
        }
        if(cover.data.id) {
          objects.push({
            Key: cover.data.id + '-1920.' + cover.data.extension
          });
        }
        if(objects.length == 0) {
          return resolve();
        }
        aws.s3Client.deleteObjects({
          Bucket: fs.Bucket.BranchImagesResized,
          Delete: {
            Objects: objects
          }
        }, function(err) {
          if(err) return reject(err);
          resolve();
        });
      });
    }).then(function () {
      // delete branch profile image from db
      return new BranchImage().delete({
        id: req.params.branchid + '-picture'
      });
    }).then(function() {
      // delete branch cover image from db
      var cover = new BranchImage();
      return cover.delete({
        id: req.params.branchid + '-cover'
      });
    }).then(function() {
      // get mod log entries for this branch
      return new ModLogEntry().findByBranch(req.params.branchid);
    }).then(function(entries) {
      // delete all mod log entries
      var promises = [];
      for(var i = 0; i < entries.length; i++) {
        promises.push(new ModLogEntry().delete({
          branchid: entries[i].branchid,
          date: entries[i].date
        }));
      }
      return Promise.all(promises);
    }).then(function () {
      // fetch all mods for this branch
      return new Mod().findByBranch(req.params.branchid);
    }).then(function(mods) {
      // delete all mods
      var promises = [];
      for(var i = 0; i < mods.length; i++) {
        promises.push(new Mod().delete({
          branchid: mods[i].branchid,
          date: mods[i].date
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      // fetch all tags on this branch
      return new Tag().findByBranch(req.params.branchid);
    }).then(function(tags) {
      // delete all tags
      var promises = [];
      for(var i = 0; i < tags.length; i++) {
        promises.push(new Tag().delete({
          branchid: tags[i].branchid,
          tag: tags[i].tag
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      // fetch all tags of this branch on other branches
      return new Tag().findByTag(req.params.branchid);
    }).then(function(tags) {
      // delete all tags
      var promises = [];
      for(var i = 0; i < tags.length; i++) {
        promises.push(new Tag().delete({
          branchid: tags[i].branchid,
          tag: tags[i].tag
        }));
      }
      return Promise.all(promises);
    }).then(function() {
      // get the deleted branch's subbranches
      return branch.findSubbranches(req.params.branchid, 0);
    }).then(function(subbranches) {
      // update all subbranches parents to 'root'
      var promises = [];
      for(var i = 0; i < subbranches.length; i++) {
        var b = new Branch(subbranches[i]);
        b.set('parentid', 'root');
        promises.push(b.update());
      }
      return Promise.all(promises);
    }).then(function() {
      return success.OK(res);
    }, function(err) {
      console.error("Error deleting branch");
      console.error(err);
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
  getPicture: function(req, res, type, thumbnail) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(type != 'picture' && type != 'cover') {
      return error.InternalServerError(res);
    }
    var size;
    if(type == 'picture') {
      size = thumbnail ? 200 : 640;
    } else {
      size = thumbnail ? 800 : 1920;
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
  getSubbranches: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(!req.query.timeafter) {
      return error.BadRequest(res, 'Missing timeafter');
    }

    var sortBy = req.query.sortBy;
    if(!req.query.sortBy) {
      sortBy = 'date';
    }

    var branch = new Branch();
    branch.findSubbranches(req.params.branchid, req.query.timeafter, sortBy).then(function(data) {
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
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
