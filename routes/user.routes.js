'use strict';

var aws = require('../config/aws.js');
var fs = require('../config/filestorage.js');

var User = require('../models/user.model.js');
var UserImage = require('../models/user-image.model.js');
var success = require('./responses/successes.js');
var error = require('./responses/errors.js');

module.exports = {
  // TODO: access controls on what user info is sent back, inc. yourself vs other users
  getSelf: function(req, res) {
    // no user object attached by passport
    if(!req.user.username) {
      return error.InternalServerError(res);
    }

    var user = new User();
    user.findByUsername(req.user.username).then(function() {
      var userResponse = {
        username: user.data.username,
        name: {
          first: user.data.firstname,
          last: user.data.lastname
        },
        email: user.data.email,
        dob: user.data.dob,
        datejoined: user.data.datejoined
      };
      return success.OK(res, userResponse);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  get:  function(req, res) {
    if(!req.params.username) {
      return error.BadRequest(res);
    }

    var user = new User();
    user.findByUsername(req.params.username).then(function() {
      var userResponse = {
        username: user.data.username,
        name: {
          first: user.data.firstname,
          last: user.data.lastname
        },
        dob: user.data.dob,
        datejoined: user.data.datejoined
      };
      return success.OK(res, userResponse);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  deleteSelf: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.Forbidden(res);
    }

    var user = new User({
      username: req.user.username
    });
    user.delete().then(function() {
      req.logout();
      return success.OK(res);
    }, function() {
      console.error('Error deleting user from database.');
      return error.InternalServerError(res);
    });
  },
  putSelf: function(req, res) {
    var user = new User(req.user);
    if(req.body.firstname) {
      user.set('firstname', req.body.firstname);
    }
    if(req.body.lastname) {
      user.set('lastname', req.body.lastname);
    }
    if(req.body.email) {
      user.set('email', req.body.email);
    }
    if(req.body.dob) {
      if(!Number(req.body.dob)) {
        return error.BadRequest(res, 'Invalid dob');
      }
      user.set('dob', Number(req.body.dob));
    }

    // Check new parameters are valid, ignoring username and password validity
    var invalids = user.validate();
    for(var i = 0; i < invalids.length; i++) {
      if(invalids[i].indexOf('username') > -1) {
        invalids.splice(invalids[i].indexOf('username'), 1);
      }
      if(invalids[i].indexOf('password') > -1) {
        invalids.splice(invalids[i].indexOf('password'), 1);
      }
    }
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }
    user.update().then(function() {
      return success.OK(res);
    }, function() {
      return error.InternalServerError(res);
    });
  },
  getProfilePictureUploadUrl: function(req, res) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    var filename = req.user.username + '-picture-orig.jpg';
    var params = {
      Bucket: fs.Bucket.UserImages,
      Key: filename,
      ContentType: 'image/*'
    }
    var url = aws.s3Client.getSignedUrl('putObject', params, function(err, url) {
      return success.OK(res, url);
    });
  },
  getOwnProfilePicture: function(req, res) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    var image = new UserImage();
    image.findByUsername(req.user.username, 'picture').then(function() {
      aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.UserImagesResized,
        Key: image.data.id + '-500.' + image.data.extension
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
  getProfilePicture: function(req, res) {
    if(!req.params.username) {
      return error.BadRequest(res);
    }

    var image = new UserImage();
    image.findByUsername(req.params.username, 'picture').then(function() {
      aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.UserImagesResized,
        Key: image.data.id + '-500.' + image.data.extension
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
  }
};
