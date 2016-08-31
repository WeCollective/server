'use strict';

var express = require('express');
var router = express.Router();
var success = require('../../responses/successes.js');
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./user.controller.js');

  /**
   * @api {post} /user Sign up
   * @apiName Sign up
   * @apiGroup User
   * @apiPermission guest
   *
   * @apiParam (Body Parameters) {String} username User's unique username. (1-20 lowercase chars, no whitespace, not numeric, not one of 'me', 'orig', 'picture', 'cover')
   * @apiParam (Body Parameters) {String} password User's password. (6-30 chars, no whitespace)
   * @apiParam (Body Parameters) {String} firstname User's first name. (2-30 chars, no whitespace)
   * @apiParam (Body Parameters) {String} lastname  User's last name. (2-30 chars, no whitespace)
   * @apiParam (Body Parameters) {String} email User's email.
   *
   * @apiUse OK
   * @apiUse BadRequest
   * @apiUse InternalServerError
   */
  router.route('/')
    .post(function(req, res, next) {
      // local-signup with override of done() method to access info object from passport strategy
      passport.authenticate('local-signup', function(err, user, info) {
        if (err) { return next(err); }
        // if no user object, send error response
        if (!user) {
          var status = 403;
          if(info.status) {
            status = info.status;
          }
          return res.status(status).json({ message: info.message });
        }
        // manually log in user to establish session
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          return success.OK(res);
        });
      })(req, res, next);
    });

  /**
   * @api {post} /user/login Login
   * @apiName Login
   * @apiGroup User
   * @apiPermission guest
   *
   * @apiParam (Body Parameters) {String} username User's unique username. (1-20 lowercase chars, no whitespace, not numeric, not one of 'me', 'orig', 'picture', 'cover')
   * @apiParam (Body Parameters) {String} password User's password. (6-30 chars, no whitespace)
   *
   * @apiUse OK
   * @apiUse BadRequest
   * @apiUse InternalServerError
   */
  router.route('/login')
    .post(function(req, res, next) {
      // local-login with override of done() method to access info object from passport strategy
      passport.authenticate('local-login', function(err, user, info) {
        if (err) { return next(err); }
        // if no user object, send error response
        if (!user) {
          console.log(info);
          return res.status(info.status).json({ message: info.message });
        }
        // manually log in user to establish session
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          return success.OK(res);
        });
      })(req, res, next);
    });

  /**
   * @api {get} /user/logout Logout
   * @apiName Logout
   * @apiGroup User
   * @apiPermission guest
   *
   * @apiUse OK
   * @apiUse InternalServerError
   */
  router.route('/logout')
    .get(function(req, res, next) {
      req.logout();
      return success.OK(res);
    });

  router.route('/me')
    /**
     * @api {get} /user/me Get Self
     * @apiName Get Self
     * @apiGroup User
     * @apiPermission self
     *
     * @apiSuccess (Successes) {String} username User's unique username.
     * @apiSuccess (Successes) {String} email User's email address.
     * @apiSuccess (Successes) {String} firstname User's first name.
     * @apiSuccess (Successes) {String} lastname User's last name.
     * @apiSuccess (Successes) {Number} dob User's date of birth (UNIX timestamp).
     * @apiSuccess (Successes) {Number} datejoined Date the user joined (UNIX timestamp).
     * @apiSuccessExample {json} SuccessResponse:
     *  {
     *    "message": "Success",
     *    "data": {
     *      "username": "johndoe",
     *      "email": "john@doe.com",
     *      "firstname": "John",
     *      "lastname": "Doe",
     *      "dob": null,
     *      "datejoined": 1469017726490
     *    }
     *  }
     *
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.get)
    /**
     * @api {delete} /user/me Delete Self
     * @apiName Delete Self
     * @apiGroup User
     * @apiPermission self
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .delete(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.delete)
    /**
     * @api {put} /user/me Update Self
     * @apiName Update Self
     * @apiGroup User
     * @apiPermission self
     *
     * @apiParam (Body Parameters) {String} firstname User's new first name. (2-30 chars, no whitespace) [optional]
     * @apiParam (Body Parameters) {String} lastname  User's new last name. (2-30 chars, no whitespace) [optional]
     * @apiParam (Body Parameters) {String} email User's new email. [optional]
     * @apiParam (Body Parameters) {Number} dob User's new date of birth (UNIX timestamp). [optional]
     *
     * @apiUse OK
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.put);

  router.route('/:username')
    /**
     * @api {get} /user/:username Get User
     * @apiName Get User
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission auth
     *
     * @apiParam (URL Parameters) {String} username User's unique username.
     *
     * @apiSuccess (Successes) {String} username User's unique username.
     * @apiSuccess (Successes) {String} email User's email address. [iff. the specified user is the authenticated user]
     * @apiSuccess (Successes) {String} firstname User's first name.
     * @apiSuccess (Successes) {String} lastname User's last name.
     * @apiSuccess (Successes) {Number} dob User's date of birth (UNIX timestamp).
     * @apiSuccess (Successes) {Number} datejoined Date the user joined (UNIX timestamp).
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": {
     *      "username": "johndoe",
     *      "firstname": "John",
     *      "lastname": "Doe",
     *      "dob": null,
     *      "datejoined": 1469017726490
     *    }
     *  }
     *
     * @apiUse Forbidden
     * @apiUse BadRequest
     * @apiUse InternalServerError
     * @apiUse NotFound
     */
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.get(req, res);
      } else {
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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPictureUploadUrl(req, res, 'picture');
    });

  router.route('/me/cover-upload-url')
    /**
     * @api {get} /me/cover-upload-url Get Cover Upload URL
     * @apiName Get Cover Upload URL
     * @apiDescription Get a pre-signed URL to which a cover picture for the authenticated user can be uploaded.
     * @apiGroup User
     * @apiPermission self
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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPictureUploadUrl(req, res, 'cover');
    });

  router.route('/me/picture')
    /**
     * @api {get} /me/picture Get Own Picture
     * @apiName Get Own Picture
     * @apiDescription Get a pre-signed URL where the authenticated user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission self
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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPicture(req, res, 'picture', false);
    });

  router.route('/me/picture-thumb')
    /**
     * @api {get} /me/picture-thumb Get Own Picture Thumbnail
     * @apiName Get Own Picture Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the authenticated user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission self
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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPicture(req, res, 'picture', true);
    });

  router.route('/me/cover')
    /**
     * @api {get} /me/cover Get Own Cover
     * @apiName Get Own Cover
     * @apiDescription Get a pre-signed URL where the authenticated user's cover picture can be accessed.
     * @apiGroup User
     * @apiPermission self
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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPicture(req, res, 'cover', false);
    });

  router.route('/me/cover-thumb')
    /**
     * @api {get} /me/cover-thumb Get Own Cover Thumbnail
     * @apiName Get Own Cover Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the authenticated user's cover picture can be accessed.
     * @apiGroup User
     * @apiPermission self
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
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), function(req, res) {
      controller.getPicture(req, res, 'cover', true);
    });

  router.route('/:username/picture')
    /**
     * @api {get} /:username/picture Get User Picture
     * @apiName Get User Picture
     * @apiDescription Get a pre-signed URL where the specified user's profile picture can be accessed.
     * @apiGroup User
     * @apiPermission guest
     * @apiPermission self
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
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.getPicture(req, res, 'picture', false);
      } else {
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
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.getPicture(req, res, 'picture', true);
      } else {
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
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.getPicture(req, res, 'cover', false);
      } else {
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
    .get(function(req, res) {
      if(req.isAuthenticated() && req.user) {
        if(req.user.username == req.params.username) {
          ACL.attachRole(ACL.Roles.Self)(req, res);
        } else {
          ACL.attachRole(ACL.Roles.AuthenticatedUser)(req, res);
        }
        controller.getPicture(req, res, 'cover', true);
      } else {
        ACL.attachRole(ACL.Roles.Guest)(req, res);
        controller.getPicture(req, res, 'cover', true);
      }
    });

  router.route('/:username/notifications')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), ACL.attachRole(ACL.Roles.Self), controller.getNotifications);

  return router;
};
