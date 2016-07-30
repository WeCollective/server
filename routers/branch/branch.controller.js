'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

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
      parentid: req.body.parentid
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
      // ensure the specified parent branch exists
      new Branch().findById(req.body.parentid).then(function() {
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
          return subbranchRequest.save();
        } else {
          return new Promise(function(resolve, reject) {
            resolve();
          });
        }
      }, function() {
        return error.NotFound(res);
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

        // save the new branch
        branch.set('parentid', 'root');
        branch.save().then(function() {
          // save the mod of the branch
          mod.save().then(function () {
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

            var rootTag = new Tag({
              branchid: branch.data.id,
              tag: 'root'
            });
            propertiesToCheck = ['branchid', 'tag'];
            invalids = rootTag.validate(propertiesToCheck);
            if(invalids.length > 0) {
              return error.BadRequest(res, 'Invalid ' + invalids[0]);
            }

            // save the tags
            branchTag.save().then(function(err) {
              return rootTag.save();
            }).then(function(err) {
              return success.OK(res);
            }).catch(function(err) {
              return error.InternalServerError(res);
            });
          }, function() {
            return error.InternalServerError(res);
          });
        }, function() {
          return error.InternalServerError(res);
        });
      }).catch(function() {
        return error.InternalServerError(res);
      });
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
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
  getSubbranches: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if(!req.query.timeafter) {
      return error.BadRequest(res, 'Missing timeafter');
    }

    var branch = new Branch();
    branch.findSubbranches(req.params.branchid, req.query.timeafter).then(function(data) {
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
