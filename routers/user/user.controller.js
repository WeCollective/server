'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var ACL = require('../../config/acl.js');
var mailer = require('../../config/mailer.js');
var auth = require('../../config/auth.js');

// Models
var User = require('../../models/user.model.js');
var UserImage = require('../../models/user-image.model.js');
var Notification = require('../../models/notification.model.js');
var Session = require('../../models/session.model.js');
var Branch = require('../../models/branch.model.js');
var FollowedBranch = require('../../models/followed-branch.model.js');

// Responses
var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

var _ = require('lodash');

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
        console.error("Error fetching user:", err);
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
    if(req.body.show_nsfw) {
      user.set('show_nsfw', req.body.show_nsfw === 'true');
      propertiesToCheck.push('show_nsfw');
    }

    // Check new parameters are valid, ignoring username and password validity
    var invalids = user.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }
    user.update().then(function() {
      // update the SendGrid contact list with the new user data
      return mailer.addContact(user.data, true);
    }).then(function() {
      return success.OK(res);
    }).catch(function() {
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
          console.error("Error getting signed url:", err);
          return error.InternalServerError(res);
        }
        return success.OK(res, url);
      });
    }, function(err) {
      if(err) {
        console.error("Error fetching user image:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getNotifications: function(req, res) {
    if(!req.user.username) {
      return error.InternalServerError(res);
    }

    var unreadCount = false;
    if(req.query.unreadCount === 'true') {
      unreadCount = true;
    }

    // if lastPostId is specified, client wants results which appear _after_ this notification (pagination)
    var lastNotification = null;
    new Promise(function(resolve, reject) {
      if(req.query.lastNotificationId) {
        var notification = new Notification();
        // get the post
        notification.findById(req.query.lastNotificationId).then(function () {
          // create lastNotification object
          lastNotification = notification.data;
          resolve();
        }).catch(function(err) {
          if(err) reject();
          return error.NotFound(res); // lastNotificationId is invalid
        });
      } else {
        // no last notification specified, continue
        resolve();
      }
    }).then(function () {
      return new Notification().findByUsername(req.user.username, unreadCount, lastNotification);
    }).then(function(notifications) {
      return success.OK(res, notifications);
    }, function(err) {
      if(err) {
        console.error("Error fetching user notifications: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  putNotification: function(req, res) {
    if(!req.user.username) {
      return error.InternalServerError(res);
    }

    if(!req.params.notificationid) {
      return error.BadRequest(res, 'Missing notificationid parameter');
    }

    if(!req.body.unread) {
      return error.BadRequest(res, 'Missing unread parameter');
    }

    var notification = new Notification();
    notification.findById(req.params.notificationid).then(function() {
      // check notification actually belongs to user
      if(notification.data.user != req.user.username) {
        return error.Forbidden(res);
      }
      req.body.unread = (req.body.unread === 'true');
      notification.set('unread', Boolean(req.body.unread));
      return notification.save(req.sessionID);
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error updating notification unread: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  subscribeToNotifications: function(req, res) {
    if(!req.user.username || !req.sessionID) {
      return error.InternalServerError(res);
    }

    if(!req.body.socketID) {
      return error.BadRequest(res, 'Missing socketID');
    }

    // fetch user's session
    var session = new Session();
    session.findById('sess:' + req.sessionID).then(function() {
      // add the socketID and save
      session.set('socketID', req.body.socketID);
      return session.save();
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error subscribing to notifications: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  unsubscribeFromNotifications: function(req, res) {
    if(!req.user.username || !req.sessionID) {
      return error.InternalServerError(res);
    }

    // fetch user's session
    var session = new Session();
    session.findById('sess:' + req.sessionID).then(function() {
      // add the socketID and save
      session.set('socketID', null);
      return session.save();
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error unsubscribing from notifications: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  sendResetPasswordLink: function(req, res) {
    if(!req.params.username) {
      return error.BadRequest(res, 'Missing username parameter');
    }

    var user = new User();
    var token;
    user.findByUsername(req.params.username).then(function() {
      var expires = new Date();
      expires.setHours(expires.getHours() + 1);
      token = {
        token: auth.generateToken(),
        expires: expires.getTime()
      };
      user.set('resetPasswordToken', JSON.stringify(token));
      return user.update();
    }, function(err) {
      if(err) {
        console.error("Error sending password reset: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    }).then(function() {
      return mailer.sendResetPasswordLink(user.data, token.token);
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      return error.InternalServerError(res);
    });
  },
  resetPassword: function(req, res) {
    if(!req.params.username || !req.params.token) {
      return error.BadRequest(res, 'Missing username or token parameter');
    }

    if(!req.body.password) {
      return error.BadRequest(res, 'Missing password parameter');
    }

    var user = new User();
    user.findByUsername(req.params.username).then(function() {
      var token = JSON.parse(user.data.resetPasswordToken);
      // check token matches
      if(token.token !== req.params.token) {
        return error.BadRequest(res, 'Invalid token');
      }
      // check token hasnt expired
      if(token.expires < new Date().getTime()) {
        return error.BadRequest(res, 'Token expired');
      }

      // validate new password
      user.set('password', req.body.password);
      var propertiesToCheck = ['password'];
      var invalids = user.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return done(null, false, { status: 400, message: 'Invalid ' + invalids[0] });
      }

      auth.generateSalt(10).then(function(salt) {
        return auth.hash(req.body.password, salt);
      }).then(function(hash) {
        user.set('password', hash);
        user.set('resetPasswordToken', null);
        return user.update();
      }).then(function() {
        return success.OK(res);
      }).catch(function() {
        return error.InternalServerError(res);
      });
    }).catch(function() {
      if(err) {
        console.error("Error changing password: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  resendVerification: function(req, res) {
    if(!req.params.username) {
      return error.BadRequest(res, 'Missing username parameter');
    }

    var user = new User();
    user.findByUsername(req.params.username).then(function() {
      // return error if already verified
      if(user.data.verified) {
        return error.BadRequest(res, 'Account is already verified');
      }

      return mailer.sendVerification(user.data, user.data.token);
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error resending verification email: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  verify: function(req, res) {
    if(!req.params.username || !req.params.token) {
      return error.BadRequest(res, 'Missing username or token parameter');
    }

    var user = new User();
    user.findByUsername(req.params.username).then(function() {
      // return success if already verified
      if(user.data.verified) {
        return success.OK(res);
      }

      // check token matches
      if(user.data.token !== req.params.token) {
        return error.BadRequest(res, 'Invalid token');
      }

      user.set('verified', true);
      return user.update();
    }).then(function() {
      // save the user's contact info in SendGrid contact list for email marketing
      var sanitized = user.sanitize(user.data, ACL.Schema(ACL.Roles.Self, 'User'));
      return mailer.addContact(sanitized);
    }).then(function () {
      // send the user a welcome email
      return mailer.sendWelcome(user.data);
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error verifying user: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getFollowedBranches: function(req, res) {
    if(!req.params.username) {
      return error.InternalServerError(res);
    }

    new FollowedBranch().findByUsername(req.params.username).then(function(branches) {
      var branchIds = _.map(branches, 'branchid');
      return success.OK(res, branchIds);
    }).catch(function() {
      if(err) {
        console.error("Error fetching followed branches:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  followBranch: function(req, res) {
    if(!req.user.username) {
      return error.InternalServerError(res);
    }

    if(!req.body.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var follow = new FollowedBranch({
      username: req.user.username,
      branchid: req.body.branchid
    });

    // Check new parameters are valid, ignoring username and password validity
    var propertiesToCheck = ['username', 'branchid'];
    var invalids = follow.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // ensure specified branchid exists
    var branch = new Branch();
    branch.findById(req.body.branchid).then(function() {
      return follow.save();
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error following branch:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  unfollowBranch: function(req, res) {
    if(!req.user.username) {
      return error.InternalServerError(res);
    }

    if(!req.query.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    // ensure specified branchid exists
    var branch = new Branch();
    branch.findById(req.query.branchid).then(function() {
      return new FollowedBranch().delete({
        username: req.user.username,
        branchid: req.query.branchid
      });
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error following branch:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
