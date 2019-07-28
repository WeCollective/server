// const _ = require('lodash');
const reqlib = require('app-root-path').require;

// const ACL = reqlib('config/acl');
const auth = reqlib('config/auth');
const Constants = reqlib('config/constants');
const fs = reqlib('config/filestorage');
const mailer = reqlib('config/mailer');
const Models = reqlib('models/');

const {
  BranchCoverType,
  BranchThumbnailType,
} = Constants;
const { BranchImageTypes } = Constants.AllowedValues;
const { createUserImageId } = Constants.Helpers;

/*
const getUsername = req => new Promise((resolve, reject) => {
  if (req.ACLRole === ACL.Roles.Self) {
    // ensure user object has been attached by passport
    if (!req.user.get('username')) {
      console.error('No username found in session.');
      return reject(error.InternalServerError);
    }

    return resolve(req.user.get('username'));
  }
  else {
    // ensure username is specified
    if (!req.params.username) {
      return reject(error.BadRequest);
    }

    return resolve(req.params.username);
  }
});
*/

/*
// todo delete user account
module.exports.delete = (req, res) => {
  if (req.ACLRole !== ACL.Roles.Self || !req.user || !req.user.get('username')) {
    return error.Forbidden(res);
  }

  return new User()
    .delete({ username: req.user.get('username') })
    .then(() => {
      req.logout();
      return next();
    })
    .catch(() => {
      console.error('Error deleting user from database.');
      return error.InternalServerError(res);
    });
};
*/

module.exports = {
  subscribeToNotifications(req, res) { // eslint-disable-line
    throw new Error('Legacy method called!');

    /*
    if (!req.user.get('username')) {
      return error.InternalServerError(res);
    }

    if (!req.body.socketID) {
      return error.BadRequest(res, 'Missing socketID');
    }
    */
  },

  unsubscribeFromNotifications(req, res) { // eslint-disable-line
    throw new Error('Legacy method called!');

    /*
    if (!req.user.get('username')) {
      return error.InternalServerError(res);
    }
    */
  },
};

module.exports.ban = (req, res, next) => {
  const { username } = req.params;

  if (!username) {
    req.error = {
      message: 'Missing username.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.User.findOne({
    where: {
      username,
    },
  })
    .then(instance => {
      if (instance === null) {
        return Promise.reject('User does not exist.');
      }

      if (instance.get('banned')) {
        return Promise.reject({
          status: 400,
          message: `${username} is already banned`,
        });
      }

      instance.set('banned', true);
      return instance.update();
    })
    .then(() => next())
    .catch(err => {
      console.error('Error fetching posts:', err);

      if (typeof err === 'object' && err.status) {
        req.error = err;
        return next(JSON.stringify(req.error));
      }

      req.error = {
        message: `User "${username}" does not exist.`,
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.followBranch = (req, res, next) => {

  const { branchid } = req.body;
  const username = req.user.get('username');

  if (!branchid) {
    req.error = {
      message: 'Missing branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (branchid === 'root') {
    req.error = {
      message: 'Invalid branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  // The branch must exist.
  return Models.Branch.findById(branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject();
      }

      return Models.FollowedBranch.create({
        branchid,
        username,
      });
    })
    .then(() => next())
    .catch(err => {
      if (err) {
        console.error('Error following branch:', err);
        req.error = {
          message: err,
        };
        return next(JSON.stringify(req.error));
      }

      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.get = (req, res, next) => {

  const clientUsername = req.user ? req.user.get('username') : false;
  let { username = clientUsername } = req.params;

  // Do not ask questions. Logout() was falling through for some reason.
  if (['logout', 'me'].includes(username) && clientUsername) {
    username = clientUsername;
  }

  const isSelf = clientUsername === username;

  const p1 = module.exports.getUserPicture(username, BranchThumbnailType, false);
  const p2 = module.exports.getUserPicture(username, BranchThumbnailType, true);
  const p3 = module.exports.getUserPicture(username, BranchCoverType, false);
  const p4 = module.exports.getUserPicture(username, BranchCoverType, true);
  const p5 = isSelf ? module.exports.getUserFollowedBranches(username) : null;
  const p6 = isSelf ? null : Models.User.findOne({
    where: {
      username,
    },
  });

  return Promise.all([p1, p2, p3, p4, p5, p6])
    .then(values => {
      const user = isSelf ? req.user : values[5];

      if (user === null) {
        return Promise.reject({
          message: 'User does not exist.',
          status: 404,
        });
      }

      const data = {
        datejoined: user.get('datejoined'),
        name: user.get('name'),
        num_branches: user.get('num_branches'),
        num_comments: user.get('num_comments'),
        num_mod_positions: user.get('num_mod_positions'),
        num_posts: user.get('num_posts'),
        username: user.get('username'),
        verified: user.get('verified'),
        profileUrl: values[0],
        profileUrlThumb: values[1],
        coverUrl: values[2],
        coverUrlThumb: values[3],
      };

      if (isSelf) {
        data.dob = user.get('dob');
        data.email = user.get('email');
        data.followed_branches = values[4];
        data.show_nsfw = user.get('show_nsfw');
        data.token = user.get('token');
      }

      res.locals.data = data;
      return next();
    })
    .catch(err => {
      if (typeof err === 'function') {
        return err(res);
      }

      console.error('Error fetching user:', err);
      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.getNotifications = (req, res, next) => {
  const {
    lastNotificationId,
    unreadCount,
  } = req.query;
  const isUnread = unreadCount === 'true';
  const username = req.user.get('username');
  // if lastNotificationId is specified, client wants results which appear _after_ this notification (pagination)
  let lastInstance = null;

  return new Promise((resolve, reject) => {
    if (lastNotificationId) {
      return Models.Notification.findById(lastNotificationId)
        .then(instance => {
          if (instance === null) {
            return Promise.reject();
          }

          lastInstance = instance;
          return resolve();
        })
        // lastNotificationId is invalid
        .catch(err => reject(err));
    }

    // no last notification specified, continue
    return resolve();
  })
    .then(() => Models.Notification.findByUsername(username, isUnread, lastInstance))
    .then(instancesOrCount => {
      let result = instancesOrCount;
      if (!isUnread) {
        // todo
        result = instancesOrCount.map(instance => instance.dataValues);
      }
      res.locals.data = result;
      return next();
    })
    .catch(err => {
      console.error('Error fetching user notifications:', err);
      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};

// Legacy method, still used to upload cover photo. That functinality
// should work the same way profile photo uploads work.
module.exports.getPictureUploadUrl = (req, res, next, type) => {
  const username = req.user.get('username');

  if (!BranchImageTypes.includes(type)) {
    console.error('Invalid picture type.');
    return next(JSON.stringify(req.error));
  }

  const params = {
    Bucket: fs.Bucket.UserImages,
    ContentType: 'image/*',
    Key: `${username}-${type}-orig.jpg`,
  };

  Models.Dynamite.aws.s3Client.getSignedUrl('putObject', params, (err, url) => {
    res.locals.data = url;
    return next();
  });
};

module.exports.getUserFollowedBranches = username => Models.FollowedBranch
  .findByUsername(username)
  .then(branches => Promise.resolve(branches.map(instance => instance.get('branchid'))))
  .catch(err => {
    console.error('Error fetching followed branches:', err);
    return Promise.reject(err);
  });

module.exports.getUserPicture = (username, type, thumbnail = false) => {
  const { BranchImageTypes } = Constants.AllowedValues;

  if (!username || !BranchImageTypes.includes(type)) return Promise.resolve('');

  let size;
  if (type === BranchThumbnailType) {
    size = thumbnail ? 200 : 640;
  }
  else if (type === BranchCoverType) {
    size = thumbnail ? 800 : 1920;
  }

  return Models.UserImage.findById(createUserImageId(username, type))
    .then(instance => {
      if (instance === null) {
        return Promise.resolve('');
      }

      const extension = instance.get('extension');
      const id = instance.get('id');

      const Bucket = fs.Bucket.UserImagesResized;
      const Key = `${id}-${size}.${extension}`;
      return Promise.resolve(`${Models.Dynamite.aws.getRootPath(Bucket)}${Key}`);
    })
    .catch(err => {
      console.error('Error fetching user image:', err);
      return Promise.resolve('');
    });
};

module.exports.markAllNotificationsRead = (req, res, next) => {
  const username = req.user.get('username');
  return Models.Notification.findByUsername(username, false, null, true)
    .then(instances => {
      console.log(instances);
      let promises = [];

      instances.forEach(instance => {
        instance.set('unread', false);
        promises = [
          ...promises,
          instance.update(),
        ];
      })

      return Promise.all(promises);
    })
    .then(() => next())
    .catch(err => {
      if (err) {
        console.error('Error marking user notifications as read:', err);
        req.error = {
          message: err,
        };
        return next(JSON.stringify(req.error));
      }

      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.put = (req, res, next) => {
  const {
    dob,
    email,
    name,
    show_nsfw,
  } = req.body;

  const { user } = req;

  if (dob !== undefined) user.set('dob', Number.parseInt(dob, 10));
  if (email !== undefined) user.set('email', email);
  if (name !== undefined) user.set('name', name);
  if (show_nsfw !== undefined) user.set('show_nsfw', show_nsfw === 'true');

  return user.update()
    .then(() => next())
    .catch(err => {
      console.error('Error updating user.', err);
      req.error = err;
      return next(JSON.stringify(req.error));
    });
};

module.exports.putNotification = (req, res, next) => {
  const { notificationid } = req.params;
  const { unread } = req.body;
  const username = req.user.get('username');

  if (!notificationid) {
    req.error = {
      message: 'Missing notificationid parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!unread) {
    req.error = {
      message: 'Missing unread parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.Notification.findById(notificationid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject('Notification does not exist.');
      }

      // check notification actually belongs to user
      if (instance.get('user') !== username) {
        return Promise.reject({
          status: 403,
        });
      }

      instance.set('unread', unread === 'true');
      return instance.update();
    })
    .then(() => next())
    .catch(err => {
      console.error('Error updating notification unread:', err);
      req.error = err;
      return next(JSON.stringify(req.error));
    });
};

module.exports.resetPassword = (req, res, next) => {
  const {
    token,
    username,
  } = req.params;
  const { password } = req.body;
  let user;

  if (!username) {
    req.error = {
      message: 'Missing username parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!token) {
    req.error = {
      message: 'Missing token parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!password) {
    req.error = {
      message: 'Missing password parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.User.findOne({
    where: {
      username,
    },
  })
    .then(instance => {
      if (instance === null) {
        return Promise.reject('User does not exist.');
      }

      user = instance;

      const uToken = JSON.parse(user.get('resetPasswordToken'));

      // check token matches
      if (uToken.token !== token) {
        return Promise.reject({
          message: 'Invalid token.',
          status: 400,
        });
      }

      // check token hasnt expired
      if (uToken.expires < new Date().getTime()) {
        return Promise.reject({
          message: 'Token expired.',
          status: 400,
        });
      }

      const isValidPassword = Models.Dynamite.validator.password(password);

      if (!isValidPassword) {
        return Promise.reject({
          message: 'Invalid password.',
          status: 400,
        });
      }

      return auth.generateSalt(10);
    })
    .then(salt => auth.hash(password, salt))
    .then(hash => {
      user.set('password', hash);
      user.set('resetPasswordToken', null);
      return user.update();
    })
    .then(() => next())
    .catch(err => {
      console.error('Error changing password:', err);
      req.error = err;
      return next(JSON.stringify(req.error));
    });
};

module.exports.resendVerification = (req, res, next) => {
  const { username } = req.params;

  if (!username) {
    req.error = {
      message: 'Missing username parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.User.findOne({
    where: {
      username,
    },
  })
    .then(instance => {
      if (instance === null) {
        return Promise.reject('User does not exist.');
      }

      if (instance.get('verified')) {
        return Promise.reject({
          message: 'Account is already verified.',
          status: 400,
        });
      }

      // todo
      return mailer.sendVerification(instance.dataValues, instance.get('token'));
    })
    .then(() => next())
    .catch(err => {
      console.error('Error resending verification email:', err);
      req.error = err;
      return next(JSON.stringify(req.error));
    });
};

module.exports.sendResetPasswordLink = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) throw {
      message: 'Missing username parameter.',
      status: 400,
    };

    const user = await Models.User.findOne({ where: { username }});
    if (user) {
      const expires = new Date();
      expires.setHours(expires.getHours() + 1);
      const jwt = {
        expires: expires.getTime(),
        token: auth.generateToken(),
      };
      user.set('resetPasswordToken', JSON.stringify(jwt));
      await user.update();
      await mailer.sendResetPasswordLink(user.dataValues, jwt.token);
    }

    next();
  }
  catch (e) {
    console.error('Error sending password reset:', e);
    req.error = e;
    next(JSON.stringify(req.error));
  }
};

module.exports.unfollowBranch = (req, res, next) => {
  const { branchid } = req.query;
  const username = req.user.get('username');

  if (!branchid) {
    req.error = {
      message: 'Missing branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (branchid === 'root') {
    req.error = {
      message: 'Invalid branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  // The branch must exist.
  return Models.Branch.findById(branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject();
      }

      return Models.FollowedBranch.destroy({
        branchid,
        username,
      });
    })
    .then(() => next())
    .catch(err => {
      if (err) {
        console.error('Error unfollowing branch:', err);
        req.error = {
          message: err,
        };
        return next(JSON.stringify(req.error));
      }

      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.verify = async (req, res, next) => {
  try {
    const { token, username } = req.params

    if (!username) throw {
      message: 'Missing username.',
      status: 400,
    }

    if (!token) throw {
      message: 'Missing token.',
      status: 400,
    }

    const user = await Models.User.findOne({ where: { username }})
    if (user === null) throw {
      status: 404,
    }

    if (!user.get('verified')) {
      // Token must be valid.
      if (user.get('token') !== token) throw {
        status: 400,
        message: 'Invalid token.',
      }

      user.set('verified', true)
      await user.update()

      // Send the user a welcome email.
      await mailer.sendWelcome(user.dataValues)
    }

    next()
  }
  catch (e) {
    const error = typeof e === 'object' && e.status ? e : { message: e }
    req.error = error
    next(JSON.stringify(req.error))
  }
}
