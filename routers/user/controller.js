const _ = require('lodash');
const ACL = require('../../config/acl');
const algolia = require('../../config/algolia');
const auth = require('../../config/auth');
const aws = require('../../config/aws');
const error = require('../../responses/errors');
const fs = require('../../config/filestorage');
const mailer = require('../../config/mailer');
const success = require('../../responses/successes');

// Models
const Branch = require('../../models/branch.model');
const FollowedBranch = require('../../models/followed-branch.model');
const Notification = require('../../models/notification.model');
// const Session = require('../../models/session.model');
const User = require('../../models/user.model');
const UserImage = require('../../models/user-image.model');

function getUsername (req) {
  return new Promise( (resolve, reject) => {
    if (req.ACLRole === ACL.Roles.Self) {
      // ensure user object has been attached by passport
      if (!req.user.username) {
        console.error('No username found in session.');
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
  ban(req, res) {
    const bannedUser = new User();
    const username = req.params.username;

    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    if (!username) {
      return error.BadRequest(res, 'Missing username');
    }

    return bannedUser.findByUsername(username)
      .then(() => {
        if (bannedUser.data.banned === true) {
          return Promise.reject({
            code: 400,
            message: `${username} is already banned`,
          });
        }

        bannedUser.set('banned', true);
        return bannedUser.update();
      })
      .then(() => success.OK(res))
      .catch(err => {
        console.error('Error fetching posts:', err);

        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.code(res, 404, `User "${username}" does not exist`);
      });
  },

  delete(req, res) {
    if (req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    return new User()
      .delete({ username: req.user.username })
      .then(() => {
        req.logout();
        return success.OK(res);
      })
      .catch(() => {
        console.error('Error deleting user from database.');
        return error.InternalServerError(res);
      });
  },

  followBranch(req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    if (!req.body.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (req.body.branchid === 'root') {
      return error.BadRequest(res, 'Invalid branchid');
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

    return branch.findById(req.body.branchid)
      .then(() => follow.save())
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          console.error('Error following branch:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  get(req, res) {
    return getUsername(req)
      .then(username => {
        const p1 = module.exports.getUserPicture(username, 'picture', false);
        const p2 = module.exports.getUserPicture(username, 'picture', true);
        const p3 = module.exports.getUserPicture(username, 'cover', false);
        const p4 = module.exports.getUserPicture(username, 'cover', true);
        const p5 = module.exports.getUserFollowedBranches(username);

        return Promise.all([p1, p2, p3, p4, p5])
          .then(values => {
            const user = new User();
            
            user.findByUsername(username)
              .then(() => {
                let sanitized = user.sanitize(user.data, ACL.Schema(req.ACLRole, 'User'));
                sanitized.profileUrl = values[0];
                sanitized.profileUrlThumb = values[1];
                sanitized.coverUrl = values[2];
                sanitized.coverUrlThumb = values[3];
                sanitized.followed_branches = values[4];
                return success.OK(res, sanitized);
              })
              .catch(err => {
                if (err) {
                  console.error('Error fetching user:', err);
                  return error.InternalServerError(res);
                }
                
                return error.NotFound(res);
              });
          });
      })
      .catch(errorCb => errorCb(res));
  },

  // Legacy version.
  getFollowedBranches(req, res) {
    getUsername(req)
      .then(username => {
        const branch = new FollowedBranch();

        branch.findByUsername(username)
          .then(branches => {
            var branchIds = _.map(branches, 'branchid');
            return success.OK(res, branchIds);
          })
          .catch(err => {
            if (err) {
              console.error('Error fetching followed branches:', err);
              return error.InternalServerError(res);
            }

            return error.NotFound(res);
          });
      })
      .catch(errorCb => errorCb(res));
  },

  getNotifications(req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    const unreadCount = req.query.unreadCount === 'true';

    // if lastNotificationId is specified, client wants results which appear _after_ this notification (pagination)
    let lastNotification = null;
    
    return new Promise((resolve, reject) => {
      if (req.query.lastNotificationId) {
        const notification = new Notification();

        // get the post
        return notification.findById(req.query.lastNotificationId)
          .then(() => {
            // create lastNotification object
            lastNotification = notification.data;
            return resolve();
          })
          .catch(err => {
            if (err) {
              return reject();
            }

            return error.NotFound(res); // lastNotificationId is invalid
          });
      }

      // no last notification specified, continue
      return resolve();
    })
      .then(() => new Notification().findByUsername(req.user.username, unreadCount, lastNotification))
      .then(notifications => success.OK(res, notifications))
      .catch(err => {
        if (err) {
          console.error('Error fetching user notifications:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  // Legacy version.
  getPicture(req, res, type, thumbnail) {
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
      console.error('Invalid picture type.');
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
      .then(() => {
        aws.s3Client.getSignedUrl('getObject', {
          Bucket: fs.Bucket.UserImagesResized,
          Key: `${image.data.id}-${size}.${image.data.extension}`
        }, (err, url) => {
          if (err) {
            console.error('Error getting signed url:', err);
            return error.InternalServerError(res);
          }

          return success.OK(res, url);
        });
      }, err => {
        if (err) {
          console.error('Error fetching user image:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  // Legacy version.
  getPictureUploadUrl(req, res, type) {
    if (!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if ('picture' !== type && 'cover' !== type) {
      console.error('Invalid picture type.');
      return error.InternalServerError(res);
    }

    const params = {
      Bucket: fs.Bucket.UserImages,
      ContentType: 'image/*',
      Key: `${req.user.username}-${type}-orig.jpg`
    }

    aws.s3Client.getSignedUrl('putObject', params, (err, url) => success.OK(res, url));
  },

  getUserFollowedBranches (username) {
    return new Promise(resolve => {
      let branches = [];

      if (!username) return resolve(branches);

      const branch = new FollowedBranch();

      branch.findByUsername(username)
        .then(branches => {
          branches = _.map(branches, 'branchid');
          return resolve(branches);
        })
        .catch( err => {
          if (err) {
            console.error('Error fetching followed branches:', err);
          }

          return resolve(branches);
        });
    });
  },

  getUserPicture(username, type, thumbnail = false) {
    return new Promise(resolve => {
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
        .then(() => {
          const Bucket = fs.Bucket.UserImagesResized;
          const Key = `${image.data.id}-${size}.${image.data.extension}`;
          return resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}`);
        })
        .catch(err => {
          if (err) {
            console.error('Error fetching user image:', err);
            return resolve('');
          }

          return resolve('');
        });
    });
  },

  markAllNotificationsRead(req, res) {
    const username = req.user.username;

    if (!username) {
      return error.InternalServerError(res);
    }

    return new Notification()
      .findByUsername(username, false, null, true)
      .then(notifications => {
        const promises = [];

        notifications.forEach(notification => {
          const row = new Notification();
          promises.push(row
            .findById(notification.id)
            .then(() => {
              row.set('unread', false);
              return row.save();
            })
            .catch(err => Promise.reject(err))
          );
        })

        return Promise.all(promises);
      })
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          console.error('Error marking user notifications as read:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  putNotification(req, res) {
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
      .then(() => {
        // check notification actually belongs to user
        if (notification.data.user !== req.user.username) {
          return error.Forbidden(res);
        }

        req.body.unread = (req.body.unread === 'true');
        notification.set('unread', Boolean(req.body.unread));
        return notification.save();
      })
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          console.error('Error updating notification unread:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  resendVerification(req, res) {
    if (!req.params.username) {
      return error.BadRequest(res, 'Missing username parameter');
    }

    const user = new User();

    user.findByUsername(req.params.username)
      .then(() => {
        // return error if already verified
        if (user.data.verified) {
          return error.BadRequest(res, 'Account is already verified');
        }

        return mailer.sendVerification(user.data, user.data.token);
      })
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          console.error('Error resending verification email:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  resetPassword(req, res) {
    if (!req.params.username || !req.params.token) {
      return error.BadRequest(res, 'Missing username or token parameter');
    }

    if (!req.body.password) {
      return error.BadRequest(res, 'Missing password parameter');
    }

    const user = new User();
    
    user.findByUsername(req.params.username)
      .then(() => {
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
          return Promise.reject({
            message: `Invalid ${invalids[0]}`,
            status: 400,
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
          .then(() => success.OK(res))
          .catch(() => error.InternalServerError(res));
      })
      .catch(err => {
        if (err) {
          console.error('Error changing password:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  sendResetPasswordLink(req, res) {
    if (!req.params.username) {
      return error.BadRequest(res, 'Missing username parameter');
    }

    const user = new User();
    let token;

    user.findByUsername(req.params.username)
      .then(() => {
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
          console.error('Error sending password reset:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      })
      .then(() => mailer.sendResetPasswordLink(user.data, token.token))
      .then(() => success.OK(res))
      .catch(() => error.InternalServerError(res));
  },

  subscribeToNotifications(req, res) {
    if (!req.user.username || !req.sessionID) {
      return error.InternalServerError(res);
    }

    if (!req.body.socketID) {
      return error.BadRequest(res, 'Missing socketID');
    }

    // fetch user's session
    // todo
    /*
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
    */
  },

  unfollowBranch(req, res) {
    if (!req.user.username) {
      return error.InternalServerError(res);
    }

    if (!req.query.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (req.query.branchid === 'root') {
      return error.BadRequest(res, 'Invalid branchid');
    }

    // ensure specified branchid exists
    const branch = new Branch();

    return branch.findById(req.query.branchid)
      .then(() => new FollowedBranch().delete({
        branchid: req.query.branchid,
        username: req.user.username,
      }))
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          console.error('Error unfollowing branch:', err);
          return error.InternalServerError(res);
        }
        
        return error.NotFound(res);
      });
  },

  unsubscribeFromNotifications(req, res) {
    if (!req.user.username || !req.sessionID) {
      return error.InternalServerError(res);
    }

    // fetch user's session
    /*
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
    */
  },
};

module.exports.put = (req, res) => {
  if (req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.username) {
    return error.Forbidden(res);
  }

  const user = new User(req.user);
  let propertiesToCheck = [];

  if (req.body.dob) {
    if (!Number(req.body.dob)) {
      return error.BadRequest(res, 'Invalid dob');
    }

    user.set('dob', Number(req.body.dob));
    propertiesToCheck = [
      ...propertiesToCheck,
      'dob',
    ];
  }

  if (req.body.email) {
    user.set('email', req.body.email);
    propertiesToCheck = [
      ...propertiesToCheck,
      'email',
    ];
  }

  if (req.body.name) {
    user.set('name', req.body.name);
    propertiesToCheck = [
      ...propertiesToCheck,
      'name',
    ];
  }
  
  if (req.body.show_nsfw) {
    user.set('show_nsfw', req.body.show_nsfw === 'true');
    propertiesToCheck = [
      ...propertiesToCheck,
      'show_nsfw',
    ];
  }

  // Check new parameters are valid, ignoring username and password validity
  const invalids = user.validate(propertiesToCheck);
  
  if (invalids.length) {
    return error.BadRequest(res, `Invalid ${invalids[0]}`);
  }

  user.update()
    // update the SendGrid contact list with the new user data
    .then(() => mailer.addContact(user.data, true))
    .then(() => algolia.updateObjects(user.data, 'user'))
    .then(() => success.OK(res))
    .catch(() => {
      console.error('Error updating user.');
      return error.InternalServerError(res);
    });
};

module.exports.verify = (req, res) => {
  const {
    token,
    username,
  } = req.params;
  const user = new User();

  if (!username) {
    return error.BadRequest(res, 'Missing username.');
  }

  if (!token) {
    return error.BadRequest(res, 'Missing token.');
  }

  user.findByUsername(username)
    .then(() => {
      // Skip if already verified.
      if (user.data.verified) {
        return Promise.reject('verified');
      }

      // Token must be valid.
      if (user.data.token !== token) {
        return Promise.reject({
          code: 400,
          message: 'Invalid token.',
        });
      }

      user.set('verified', true);
      return user.update();
    })
    // Save the user's contact info in SendGrid contact list for email marketing.
    .then(() => {
      const sanitized = user.sanitize(user.data, ACL.Schema(ACL.Roles.Self, 'User'));
      return mailer.addContact(sanitized);
    })
    // Send the user a welcome email.
    .then(() => mailer.sendWelcome(user.data))
    .catch(err => {
      if (err === 'verified') {
        return Promise.resolve();
      }

      return Promise.reject(err);
    })
    .then(() => success.OK(res))
    .catch(err => {
      if (err) {
        console.error('Error verifying user:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};
