'use strict';

const express = require('express');

const ACL = require('../../config/acl');
const Constant = require('../../models/constant');
const passport = require('../../config/passport')();
const success = require('../../responses/successes');

const router = express.Router();

module.exports = app => {
  const controller = require('./controller');

  /**
   * @api {post} /user Sign up
   * @apiName Sign up
   * @apiGroup User
   * @apiPermission guest
   * @apiVersion 1.0.0
   *
   * @apiParam (Body Parameters) {String} email User's email.
   * @apiParam (Body Parameters) {String} firstname User's first name. (2-30 chars, no whitespace)
   * @apiParam (Body Parameters) {String} password User's password. (6-30 chars, no whitespace)
   * @apiParam (Body Parameters) {String} username User's unique username. (1-20 lowercase chars, no whitespace, not numeric, not one of 'me', 'orig', 'picture', 'cover')
   *
   * @apiUse OK
   * @apiUse BadRequest
   * @apiUse InternalServerError
   */
  router.route('/')
    .post((req, res, next) => {
      // local-signup with override of done() method to access info object from passport strategy
      passport.authenticate(passport.authenticate('jwt'), 'local-signup', (err, user, info) => {
        if (err) {
          return next(err);
        }
        
        // If no user object, send error response
        if (!user) {
          return res.status(info.status || 403).json({ message: info.message });
        }

        req.logout();

        const userCount = new Constant();
        
        return userCount.findById('user_count')
          .then(() => {
            userCount.set('data', userCount.data.data + 1);
            return userCount.update();
          })
          .then(() => success.OK(res))
          .catch(err => {
            console.error('Error updating user count:', err);
            return success.OK(res);
          });
      })(req, res, next);
    });

  /**
   * @api {post} /user/login Login
   * @apiName Login
   * @apiGroup User
   * @apiPermission guest#
   * @apiVersion 1.0.0
   *
   * @apiParam (Body Parameters) {String} username User's unique username. (1-20 lowercase chars, no whitespace, not numeric, not one of 'me', 'orig', 'picture', 'cover')
   * @apiParam (Body Parameters) {String} password User's password. (6-30 chars, no whitespace)
   *
   * @apiUse OK
   * @apiUse BadRequest
   * @apiUse InternalServerError
   */
  router.route('/login')
    .post((req, res, next) => {
      // local-login with override of done() method to access info object from passport strategy
      passport.authenticate('LocalSignIn', (err, user, info) => {
        if (err) {
          return next(err);
        }
        
        // if no user object, send error response
        if (!user) {
          return res.status(info.status).json({ message: info.message });
        }

        return success.OK(res, user.jwt);
        /*

        console.log(req.logIn);

        // manually log in user to establish session
        req.logIn(user, err => {
          if (err) {
            return next(err);
          }

          return success.OK(res);
        });
        */
      })(req, res, next);
    });

  /**
   * @api {get} /user/logout Logout
   * @apiName Logout
   * @apiGroup User
   * @apiPermission guest
   * @apiVersion 1.0.0
   *
   * @apiUse OK
   * @apiUse InternalServerError
   */
  router.route('/logout')
    .get(passport.authenticate('jwt'), (req, res, next) => {
      // req.logout();
      return success.OK(res);
    });

  router.route('/me')
    /**
     * @api {get} /user/me Get Self
     * @apiName Get Self
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {Number} datejoined Date the user joined (UNIX timestamp).
     * @apiSuccess (Successes) {Number} dob User's date of birth (UNIX timestamp).
     * @apiSuccess (Successes) {String} email User's email address.
     * @apiSuccess (Successes) {String} firstname User's name.
     * @apiSuccess (Successes) {String} username User's unique username.
     * @apiSuccessExample {json} SuccessResponse:
     *  {
     *    "message": "Success",
     *    "data": {
     *      "datejoined": 1469017726490,
     *      "dob": null, 
     *      "email": "john@doe.com",
     *      "name": "John",
     *      "username": "johndoe"
     *    }
     *  }
     *
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), controller.get)
    /**
     * @api {delete} /user/me Delete Self
     * @apiName Delete Self
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .delete(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), controller.delete)
    /**
     * @api {put} /user/me Update Self
     * @apiName Update Self
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (Body Parameters) {Number} dob User's new date of birth (UNIX timestamp). [optional]
     * @apiParam (Body Parameters) {String} email User's new email. [optional]
     * @apiParam (Body Parameters) {String} name  User's new name. (2-30 chars, no whitespace) [optional]
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .put(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), controller.put);

  router.route('/:username')
    /**
     * @api {get} /user/:username Get User
     * @apiName Get User
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiSuccess (Successes) {Number} datejoined Date the user joined (UNIX timestamp).
     * @apiSuccess (Successes) {Number} dob User's date of birth (UNIX timestamp).
     * @apiSuccess (Successes) {String} email User's email address. [iff. the specified user is the authenticated user]
     * @apiSuccess (Successes) {String} name User's name.
     * @apiSuccess (Successes) {String} username User's unique username.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": {
     *      "datejoined": 1469017726490,
     *      "dob": null,
     *      "name": "John",
     *      "username": "johndoe"
     *    }
     *  }
     *
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      if (req.isAuthenticated() && req.user) {
        if (req.user.username === req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        }
        else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }

        controller.get(req, res);
      }
      else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.get(req, res);
      }
    });

  router.route('/me/picture-upload-url')
    /**
     * @api {get} /me/picture-upload-url Get Picture Upload URL
     * @apiName Get Picture Upload URL
     * @apiDescription Get a pre-signed URL to which a profile picture for the authenticated user can be uploaded.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), (req, res) => controller.getPictureUploadUrl(req, res, 'picture'));

  router.route('/me/cover-upload-url')
    /**
     * @api {get} /me/cover-upload-url Get Cover Upload URL
     * @apiName Get Cover Upload URL
     * @apiDescription Get a pre-signed URL to which a cover picture for the authenticated user can be uploaded.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), (req, res) => controller.getPictureUploadUrl(req, res, 'cover'));

  router.route('/me/picture')
    /**
     * @api {get} /me/picture Get Own Picture
     * @apiName Get Own Picture
     * @apiDescription Get a pre-signed URL where the authenticated user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), (req, res) => controller.getPicture(req, res, 'picture', false));

  router.route('/me/picture-thumb')
    /**
     * @api {get} /me/picture-thumb Get Own Picture Thumbnail
     * @apiName Get Own Picture Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the authenticated user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), (req, res) => controller.getPicture(req, res, 'picture', true));

  router.route('/me/cover')
    /**
     * @api {get} /me/cover Get Own Cover
     * @apiName Get Own Cover
     * @apiDescription Get a pre-signed URL where the authenticated user's cover picture can be accessed.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), (req, res) => controller.getPicture(req, res, 'cover', false));

  router.route('/me/cover-thumb')
    /**
     * @api {get} /me/cover-thumb Get Own Cover Thumbnail
     * @apiName Get Own Cover Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the authenticated user's cover picture can be accessed.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), (req, res) => controller.getPicture(req, res, 'cover', true));

  router.route('/:username/picture')
    /**
     * @api {get} /:username/picture Get User Picture
     * @apiName Get User Picture
     * @apiDescription Get a pre-signed URL where the specified user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      if (req.isAuthenticated() && req.user) {
        if (req.user.username === req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        }
        else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }

        controller.getPicture(req, res, 'picture', false);
      }
      else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'picture', false);
      }
    });

  router.route('/:username/picture-thumb')
    /**
     * @api {get} /:username/picture-thumb Get User Picture Thumbnail
     * @apiName Get User Picture Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the specified user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      if (req.isAuthenticated() && req.user) {
        if (req.user.username === req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        }
        else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }

        controller.getPicture(req, res, 'picture', true);
      }
      else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'picture', true);
      }
    });

  router.route('/:username/cover')
    /**
     * @api {get} /:username/picture Get User Cover
     * @apiName Get User Cover
     * @apiDescription Get a pre-signed URL where the specified user's cover picture can be accessed.
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      if (req.isAuthenticated() && req.user) {
        if (req.user.username === req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        }
        else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }

        controller.getPicture(req, res, 'cover', false);
      }
      else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'cover', false);
      }
    });

  router.route('/:username/cover-thumb')
    /**
     * @api {get} /:username/cover-thumb Get User Cover Thumbnail
     * @apiName Get User Cover Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the specified user's cover picture can be accessed.
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      if (req.isAuthenticated() && req.user) {
        if (req.user.username === req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        }
        else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }

        controller.getPicture(req, res, 'cover', true);
      }
      else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'cover', true);
      }
    });

  router.route('/:username/notifications')
    /**
     * @api {get} /:username/notifications Get User Notifications
     * @apiName Get User Notifications
     * @apiDescription Get a list of notifications for the specified user, or a count of the number of unread ones.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     * @apiParam (Query Parameters) {String} unreadCount Boolean indicating whether to fetch the number of unread notifications rather than notifications themselves.
     * @apiParam (Query Parameters) {String} lastNotificationId The id of the last notification seen by the client. Results _after_ this notification will be returned, facilitating pagination.
     *
     * @apiSuccess (Successes) {String} data The notifications array, or a count
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<notifications>"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      (req, res, next) => ACL.validateRole(ACL.Roles.Self, req.params.username)(req, res, next),
      controller.getNotifications)

    /**
     * @api {put} /:username/notifications Subscribe to Notifications
     * @apiName Subscribe to Notifications
     * @apiDescription Subscribe the user to receive real-time notifications using Web Sockets.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     * @apiParam (URL Parameters) {String} socketID User's unique web socket ID (provided by Socket.io)
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .put(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      (req, res, next) => ACL.validateRole(ACL.Roles.Self, req.params.username)(req, res, next),
      controller.subscribeToNotifications)

    /**
     * @api {delete} /:username/notifications Unsubscribe from Notifications
     * @apiName Unsubscribe from Notifications
     * @apiDescription Unsubscribe the user from receiving real-time notifications using Web Sockets.
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .delete(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      ACL.attachRole(ACL.Roles.Self), controller.unsubscribeFromNotifications);

  router.route('/:username/notifications/:notificationid')
    /**
     * @api {put} /:username/notifications/:notificationid Mark notification
     * @apiName Mark notification
     * @apiDescription Mark notification as read/unread
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     * @apiParam (URL Parameters) {String} notificationid Notification's unique ID.
     *
     * @apiParam (Body Parameters) {String} unread Boolean indicating whether the notification should be marked as unread/read.
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .put(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      (req, res, next) => ACL.validateRole(ACL.Roles.Self, req.params.username)(req, res, next),
      controller.putNotification);

  router.route('/:username/reset-password')
    /**
     * @api {get} /:username/reset-password Request password reset
     * @apiName Request password reset
     * @apiDescription Request a password reset link to the users inbox
     * @apiGroup User
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiUse OK
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), ACL.attachRole(ACL.Roles.Guest), controller.sendResetPasswordLink);

  router.route('/:username/reset-password/:token')
    /**
     * @api {post} /:username/reset-password/:token Perform password reset
     * @apiName Perform password reset
     * @apiDescription Reset a users password using a valid token obtained via a password reset email
     * @apiGroup User
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     * @apiParam (URL Parameters) {String} token Valid password reset token
     *
     * @apiParam (Body Parameters) {String} password The new password for the user
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .post(passport.authenticate('jwt'), ACL.attachRole(ACL.Roles.Guest), controller.resetPassword);

  router.route('/:username/reverify')
    /**
     * @api {get} /:username/reverify Resend a user verification email
     * @apiName Resend a user verification email
     * @apiDescription Request a new verification email to be sent to the users inbox
     * @apiGroup User
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), ACL.attachRole(ACL.Roles.Guest), controller.resendVerification);
  router.route('/:username/verify/:token')
    /**
     * @api {get} /:username/verify/:token Verify a user
     * @apiName Verify a user
     * @apiDescription Verify a user using a valid token from a verification email sent to their inbox
     * @apiGroup User
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), ACL.attachRole(ACL.Roles.Guest), controller.verify);

  router.route('/:username/branches/followed')
    /**
     * @api {get} /:username/branches/followed Get followed branches
     * @apiName Get followed branches
     * @apiDescription Get the branches a user follows
     * @apiGroup User
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      if (req.isAuthenticated() && req.user) {
        if (req.user.username === req.params.username || req.params.username === 'me') {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        }
        else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }

        controller.getFollowedBranches(req, res);
      }
      else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getFollowedBranches(req, res);
      }
    })
    /**
     * @api {post} /:username/branches/followed Follow a branch
     * @apiName Follow a branch
     * @apiDescription Follow a branch
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiParam (Body Parameters) {String} branchid The id of the branch to follow
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .post(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      (req, res, next) => ACL.validateRole(ACL.Roles.Self, req.params.username)(req, res, next),
      controller.followBranch)
    /**
     * @api {delete} /:username/branches/followed Unfollow a branch
     * @apiName Unfollow a branch
     * @apiDescription Unfollow a branch
     * @apiGroup User
     * @apiPermission self
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiParam (Query Parameters) {String} branchid The id of the branch to stop following
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .delete(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser),
      (req, res, next) => ACL.validateRole(ACL.Roles.Self, req.params.username)(req, res, next),
      controller.unfollowBranch);

  return router;
};
