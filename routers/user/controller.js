'use strict';

const _   = require('lodash');
const ACL = require('../../config/acl');
const auth  = require('../../config/auth');
const aws   = require('../../config/aws');
const error = require('../../responses/errors');
const fs = require('../../config/filestorage');
const mailer  = require('../../config/mailer');
const success = require('../../responses/successes');

// Models
const Branch = require('../../models/branch.model');
const FollowedBranch = require('../../models/followed-branch.model');
const Notification = require('../../models/notification.model');
const Session = require('../../models/session.model');
const User = require('../../models/user.model');
const UserImage = require('../../models/user-image.model');

function getUsername (req) {
  return new Promise( (resolve, reject) => {
    if (req.ACLRole === ACL.Roles.Self) {
      // ensure user object has been attached by passport
      if (!req.user.username) {
        console.error(`No username found in session.`);
        return reject(error.InternalServerError);
      }
      
      return resolve(req.user.username);
    }
    else {
      // ensure username is specified
      if (!req.params.username) {
        return reject(error.BadRequest);
      }
      
      return resolve(req.params.username);
    }
  });
}

module.exports = {
  delete (req, res) {
    if (req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    const user = new User();

    user.delete({ username: req.user.username })
      .then( _ => {
        req.logout();
        return success.OK(res);
      })
      .catch( _ => {
        console.error(`Error deleting user from database.`);
        return error.InternalServerError(res);
      });
  },

  followBranch (req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    if (!req.body.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    const follow = new FollowedBranch({
      username: req.user.username,
      branchid: req.body.branchid
    });

    // Check new parameters are valid, ignoring username and password validity
    const propertiesToCheck = ['username', 'branchid'];
    const invalids = follow.validate(propertiesToCheck);
    
    if (invalids.length) {
      return error.BadRequest(res, `Invalid ${invalids[0]}`);
    }

    // ensure specified branchid exists
    const branch = new Branch();

    branch.findById(req.body.branchid)
      .then( _ => follow.save() )
      .then( _ => success.OK(res) )
      .catch( err => {
        if (err) {
          console.error(`Error following branch:`, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  get (req, res) {
    getUsername(req).then( username => {
      const p1 = module.exports.getUserPicture(username, 'picture', false);
      const p2 = module.exports.getUserPicture(username, 'picture', true);
      const p3 = module.exports.getUserPicture(username, 'cover', false);
      const p4 = module.exports.getUserPicture(username, 'cover', true);
      const p5 = module.exports.getUserFollowedBranches(username);

      Promise.all([p1, p2, p3, p4, p5]).then( values => {
        const user = new User();
        
        user.findByUsername(username)
          .then( _ => {
            let sanitized = user.sanitize(user.data, ACL.Schema(req.ACLRole, 'User'));
            sanitized.profileUrl = values[0];
            sanitized.profileUrlThumb = values[1];
            sanitized.coverUrl = values[2];
            sanitized.coverUrlThumb = values[3];
            sanitized.followed_branches = values[4];
            return success.OK(res, sanitized);
          })
          .catch( err => {
            if (err) {
              console.error(`Error fetching user:`, err);
              return error.InternalServerError(res);
            }
            
            return error.NotFound(res);
          });
      });
    })
    .catch( errorCb => {
      return errorCb(res);
    });
  },

  // Legacy version.
  getFollowedBranches (req, res) {
    getUsername(req).then( username => {
      const branch = new FollowedBranch();

      branch.findByUsername(username)
        .then( branches => {
          var branchIds = _.map(branches, 'branchid');
          return success.OK(res, branchIds);
        })
        .catch( err => {
          if (err) {
            console.error(`Error fetching followed branches:`, err);
            return error.InternalServerError(res);
          }

          return error.NotFound(res);
        });
    })
    .catch( errorCb => {
      return errorCb(res);
    });
  },

  getNotifications (req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    const unreadCount = req.query.unreadCount === 'true';

    // if lastNotificationId is specified, client wants results which appear _after_ this notification (pagination)
    let lastNotification = null;
    
    new Promise( (resolve, reject) => {
      if (req.query.lastNotificationId) {
        const notification = new Notification();
        // get the post
        notification.findById(req.query.lastNotificationId)
          .then( _ => {
            // create lastNotification object
            lastNotification = notification.data;
            return resolve();
          })
          .catch( err => {
            if (err) {
              return reject();
            }
            
            return error.NotFound(res); // lastNotificationId is invalid
          });
      }
      else {
        // no last notification specified, continue
        return resolve();
      }
    })
      .then( _ => new Notification().findByUsername(req.user.username, unreadCount, lastNotification) )
      .then( notifications => success.OK(res, notifications) )
      .catch( err => {
        if (err) {
          console.error(`Error fetching user notifications:`, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  // Legacy version.
  getPicture (req, res, type, thumbnail) {
    let size,
      username;

    if (req.ACLRole == ACL.Roles.Self) {
      // ensure user object has been attached by passport
      if (!req.user.username) {
        return error.InternalServerError(res);
      }
      
      username = req.user.username;
    }
    else {
      // ensure username is specified
      if (!req.params.username) {
        return error.BadRequest(res);
      }

      username = req.params.username;
    }

    if (type !== 'picture' && type !== 'cover') {
      console.error(`Invalid picture type.`);
      return error.InternalServerError(res);
    }

    if (type === 'picture') {
      size = thumbnail ? 200 : 640;
    }
    else {
      size = thumbnail ? 800 : 1920;
    }

    const image = new UserImage();

    image.findByUsername(username, type)
      .then( _ => {
        aws.s3Client.getSignedUrl('getObject', {
          Bucket: fs.Bucket.UserImagesResized,
          Key: `${image.data.id}-${size}.${image.data.extension}`
        }, (err, url) => {
          if (err) {
            console.error(`Error getting signed url:`, err);
            return error.InternalServerError(res);
          }

          return success.OK(res, url);
        });
      }, err => {
        if (err) {
          console.error(`Error fetching user image:`, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  // Legacy version.
  getPictureUploadUrl (req, res, type) {
    if (!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if ('picture' !== type && 'cover' !== type) {
      console.error(`Invalid picture type.`);
      return error.InternalServerError(res);
    }

    const params = {
      Bucket: fs.Bucket.UserImages,
      ContentType: 'image/*',
      Key: `${req.user.username}-${type}-orig.jpg`
    }

    let url = aws.s3Client.getSignedUrl('putObject', params, (err, url) => success.OK(res, url) );
  },

  getUserFollowedBranches (username) {
    return new Promise( (resolve, reject) => {
      let branches = [];

      if (!username) return resolve(branches);

      const branch = new FollowedBranch();

      branch.findByUsername(username)
        .then( branches => {
          branches = _.map(branches, 'branchid');
          return resolve(branches);
        })
        .catch( err => {
          if (err) {
            console.error(`Error fetching followed branches:`, err);
          }

          return resolve(branches);
        });
    });
  },

  getUserPicture (username, type, thumbnail = false) {
    return new Promise( (resolve, reject) => {
      if (!username || ('picture' !== type && 'cover' !== type)) return resolve('');

      let size;

      if ('picture' === type) {
        size = thumbnail ? 200 : 640;
      }
      else if ('cover' === type) {
        size = thumbnail ? 800 : 1920;
      }

      const image = new UserImage();

      image.findByUsername(username, type)
        .then( _ => {
          const Bucket = fs.Bucket.UserImagesResized;
          const Key = `${image.data.id}-${size}.${image.data.extension}`;
          return resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}`);
        })
        .catch( err => {
          if (err) {
            console.error(`Error fetching user image:`, err);
            return resolve('');
          }

          return resolve('');
        });
    });
  },

  put (req, res) {
    if (req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    let user = new User(req.user);
    let propertiesToCheck = [];

    if (req.body.dob) {
      if (!Number(req.body.dob)) {
        return error.BadRequest(res, 'Invalid dob');
      }

      user.set('dob', Number(req.body.dob));
      propertiesToCheck.push('dob');
    }

    if (req.body.email) {
      user.set('email', req.body.email);
      propertiesToCheck.push('email');
    }

    if (req.body.name) {
      user.set('name', req.body.name);
      propertiesToCheck.push('name');
    }
    
    if (req.body.show_nsfw) {
      user.set('show_nsfw', req.body.show_nsfw === 'true');
      propertiesToCheck.push('show_nsfw');
    }

    // Check new parameters are valid, ignoring username and password validity
    let invalids = user.validate(propertiesToCheck);
    
    if (invalids.length) {
      return error.BadRequest(res, `Invalid ${invalids[0]}`);
    }

    user.update()
      .then( _ => {
        // update the SendGrid contact list with the new user data
        return mailer.addContact(user.data, true);
      })
      .then( _ => success.OK(res) )
      .catch( _ => {
        console.error(`Error updating user.`);
        return error.InternalServerError(res);
      });
  },

  putNotification (req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    if (!req.params.notificationid) {
      return error.BadRequest(res, 'Missing notificationid parameter');
    }

    if (!req.body.unread) {
      return error.BadRequest(res, 'Missing unread parameter');
    }

    const notification = new Notification();

    notification.findById(req.params.notificationid)
      .then( _ => {
        // check notification actually belongs to user
        if (notification.data.user !== req.user.username) {
          return error.Forbidden(res);
        }

        req.body.unread = (req.body.unread === 'true');
        notification.set('unread', Boolean(req.body.unread));
        return notification.save(req.sessionID);
      })
      .then( _ => success.OK(res) )
      .catch( err => {
        if (err) {
          console.error(`Error updating notification unread: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  resendVerification (req, res) {
    if (!req.params.username) {
      return error.BadRequest(res, 'Missing username parameter');
    }

    const user = new User();

    user.findByUsername(req.params.username)
      .then( _ => {
        // return error if already verified
        if (user.data.verified) {
          return error.BadRequest(res, 'Account is already verified');
        }

        return mailer.sendVerification(user.data, user.data.token);
      })
      .then( _ => success.OK(res) )
      .catch( err => {
        if (err) {
          console.error(`Error resending verification email: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  resetPassword (req, res) {
    if (!req.params.username || !req.params.token) {
      return error.BadRequest(res, 'Missing username or token parameter');
    }

    if (!req.body.password) {
      return error.BadRequest(res, 'Missing password parameter');
    }

    const user = new User();
    
    user.findByUsername(req.params.username)
      .then( _ => {
        const token = JSON.parse(user.data.resetPasswordToken);
        
        // check token matches
        if (token.token !== req.params.token) {
          return error.BadRequest(res, 'Invalid token');
        }
        
        // check token hasnt expired
        if (token.expires < new Date().getTime()) {
          return error.BadRequest(res, 'Token expired');
        }

        // validate new password
        user.set('password', req.body.password);
        
        const propertiesToCheck = ['password'];
        const invalids = user.validate(propertiesToCheck);
        
        if (invalids.length) {
          return done(null, false, {
            message: `Invalid ${invalids[0]}`,
            status: 400
          });
        }

        auth.generateSalt(10)
          .then( salt => {
            return auth.hash(req.body.password, salt);
          })
          .then( hash => {
            user.set('password', hash);
            user.set('resetPasswordToken', null);
            return user.update();
          })
          .then( _ => success.OK(res) )
          .catch( _ => {
            return error.InternalServerError(res);
          });
      })
      .catch( _ => {
        if (err) {
          console.error(`Error changing password: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  sendResetPasswordLink (req, res) {
    if (!req.params.username) {
      return error.BadRequest(res, 'Missing username parameter');
    }

    const user = new User();
    let token;

    user.findByUsername(req.params.username)
      .then( _ => {
        let expires = new Date();
        expires.setHours(expires.getHours() + 1);
        token = {
          token: auth.generateToken(),
          expires: expires.getTime()
        };
        user.set('resetPasswordToken', JSON.stringify(token));
        return user.update();
      }, err => {
        if (err) {
          console.error(`Error sending password reset: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      })
      .then( _ => mailer.sendResetPasswordLink(user.data, token.token) )
      .then( _ => success.OK(res) )
      .catch( err => {
        return error.InternalServerError(res);
      });
  },

  subscribeToNotifications (req, res) {
    if (!req.user.username || !req.sessionID) {
      return error.InternalServerError(res);
    }

    if (!req.body.socketID) {
      return error.BadRequest(res, 'Missing socketID');
    }

    // fetch user's session
    const session = new Session();
    
    session.findById(`sess:${req.sessionID}`)
      .then( _ => {
        // add the socketID and save
        session.set('socketID', req.body.socketID);
        return session.save();
      })
      .then( _ => success.OK(res) )
      .catch( err => {
        if (err) {
          console.error(`Error subscribing to notifications: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  unfollowBranch (req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    if (!req.query.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    // ensure specified branchid exists
    const branch = new Branch();

    branch.findById(req.query.branchid)
      .then( _ => {
        return new FollowedBranch().delete({
          username: req.user.username,
          branchid: req.query.branchid
        });
      })
      .then( _ => success.OK(res) )
      .catch( err => {
        if (err) {
          console.error(`Error following branch:`, err);
          return error.InternalServerError(res);
        }
        
        return error.NotFound(res);
      });
  },

  unsubscribeFromNotifications (req, res) {
    if (!req.user.username || !req.sessionID) {
      return error.InternalServerError(res);
    }

    // fetch user's session
    const session = new Session();
    
    session.findById(`sess:${req.sessionID}`)
      .then( _ => {
        // add the socketID and save
        session.set('socketID', null);
        return session.save();
      })
      .then( _ => {
        return success.OK(res);
      })
      .catch( err => {
        if (err) {
          console.error(`Error unsubscribing from notifications: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  verify (req, res) {
    if (!req.params.username || !req.params.token) {
      return error.BadRequest(res, 'Missing username or token parameter');
    }

    const user = new User();

    user.findByUsername(req.params.username)
      .then( _ => {
        // return success if already verified
        if (user.data.verified) {
          return success.OK(res);
        }

        // check token matches
        if (user.data.token !== req.params.token) {
          return error.BadRequest(res, 'Invalid token');
        }

        user.set('verified', true);
        return user.update();
      })
      .then( _ => {
        // save the user's contact info in SendGrid contact list for email marketing
        const sanitized = user.sanitize(user.data, ACL.Schema(ACL.Roles.Self, 'User'));
        return mailer.addContact(sanitized);
      })
      // send the user a welcome email
      .then( _ => mailer.sendWelcome(user.data) )
      .then( _ => success.OK(res) )
      .catch( err => {
        if (err) {
          console.error(`Error verifying user: `, err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  }
};
