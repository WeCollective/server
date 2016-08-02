'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var ACL = require('../../config/acl.js');

// Models
var User = require('../../models/user.model.js');
var UserImage = require('../../models/user-image.model.js');

// Responses
var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  get:  function(req, res) {
    var username;
    if(req.ACLRole == ACL.Roles.Self) {
      // ensure user object has been attached by passport
      if(!req.user.username) {
        console.error("No username found in session.");
        return error.InternalServerError(res);
      }
      username = req.user.username;
    } else {
      // ensure username is specified
      if(!req.params.username) {
        return error.BadRequest(res);
      }
      username = req.params.username;
    }

    var user = new User();
    user.findByUsername(username).then(function() {
      var sanitized = user.sanitize(user.data, ACL.Schema(req.ACLRole, 'User'));
      return success.OK(res, sanitized);
    }, function(err) {
      if(err) {
        console.error("Error fetching user.");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  delete: function(req, res) {
    if(req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    var user = new User();
    user.delete({
      username: req.user.username
    }).then(function() {
      req.logout();
      return success.OK(res);
    }, function() {
      console.error('Error deleting user from database.');
      return error.InternalServerError(res);
    });
  },
  put: function(req, res) {
    if(req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    var user = new User(req.user);
    var propertiesToCheck = [];
    if(req.body.firstname) {
      user.set('firstname', req.body.firstname);
      propertiesToCheck.push('firstname');
    }
    if(req.body.lastname) {
      user.set('lastname', req.body.lastname);
      propertiesToCheck.push('lastname');
    }
    if(req.body.email) {
      user.set('email', req.body.email);
      propertiesToCheck.push('email');
    }
    if(req.body.dob) {
      if(!Number(req.body.dob)) {
        return error.BadRequest(res, 'Invalid dob');
      }
      user.set('dob', Number(req.body.dob));
      propertiesToCheck.push('dob');
    }

    // Check new parameters are valid, ignoring username and password validity
    var invalids = user.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }
    user.update().then(function() {
      return success.OK(res);
    }, function() {
      console.error("Error updating user.");
      return error.InternalServerError(res);
    });
  },
  getPictureUploadUrl: function(req, res, type) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if(type != 'picture' && type != 'cover') {
      console.error("Invalid picture type.");
      return error.InternalServerError(res);
    }

    var filename = req.user.username + '-' + type + '-orig.jpg';
    var params = {
      Bucket: fs.Bucket.UserImages,
      Key: filename,
      ContentType: 'image/*'
    }
    var url = aws.s3Client.getSignedUrl('putObject', params, function(err, url) {
      return success.OK(res, url);
    });
  },
  getPicture: function(req, res, type, thumbnail) {
    var username;
    if(req.ACLRole == ACL.Roles.Self) {
      // ensure user object has been attached by passport
      if(!req.user.username) {
        return error.InternalServerError(res);
      }
      username = req.user.username;
    } else {
      // ensure username is specified
      if(!req.params.username) {
        return error.BadRequest(res);
      }
      username = req.params.username;
    }

    if(type != 'picture' && type != 'cover') {
      console.error("Invalid picture type.");
      return error.InternalServerError(res);
    }
    var size;
    if(type == 'picture') {
      size = thumbnail ? 200 : 640;
    } else {
      size = thumbnail ? 800 : 1920;
    }

    var image = new UserImage();
    image.findByUsername(username, type).then(function() {
      aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.UserImagesResized,
        Key: image.data.id + '-' + size + '.' + image.data.extension
      }, function(err, url) {
        if(err) {
          console.error("Error getting signed url.");
          return error.InternalServerError(res);
        }
        return success.OK(res, url);
      });
    }, function(err) {
      if(err) {
        console.error("Error fetching user.");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
