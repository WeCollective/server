'use strict';

const express = require('express');

const ACL = require('../../config/acl');
const passport = require('../../config/passport')();

const router = express.Router();

module.exports = () => {
  const controller = require('./controller');

  router.route('/')
    /**
     * @api {post} /branch Create Branch
     * @apiName Create Branch
     * @apiGroup Branch
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (Body Parameters) {String} id Branch unique id.
     * @apiParam (Body Parameters) {String} name Branch name. (6-30 chars, no whitespace)
     * @apiParam (Body Parameters) {String} parentid Unique id of the requested parent branch. A Child Branch Request will be sent to this branch.
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .post(passport.authenticate('jwt'), ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.post);

  router.route('/:branchid')
    /**
     * @api {get} /:branchid Get Branch
     * @apiName Get Branch
     * @apiGroup Branch
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), controller.get)
    /**
     * @api {put} /:branchid Update Branch
     * @apiName Update Branch
     * @apiGroup Branch
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (Body Parameters) {String} name Branch visible name. [optional]
     * @apiParam (Body Parameters) {String} description Branch description. [optional]
     * @apiParam (Body Parameters) {String} rules Branch rules. [optional]
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .put(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.put)
    /**
     * @api {delete} /:branchid Delete Branch
     * @apiName Delete Branch
     * @apiDescription Permanently delete a root branch. The child branches are made into root branches.
     * @apiGroup Branch
     * @apiPermission admin
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .delete(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid, {
        code: 403,
        message: `You need to be an admin of b/${req.params.branchid}`,
      })(req, res, next);
    }, controller.delete);

  router.route('/:branchid/picture-upload-url')
    /**
     * @api {get} /:branchid/picture-upload-url Get Picture Upload URL
     * @apiName Get Picture Upload URL
     * @apiDescription Get a pre-signed URL to which a profile picture for the specified branch can be uploaded.
     * @apiGroup Branch
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
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
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, (req, res) => {
      controller.getPictureUploadUrl(req, res, 'picture');
    });

  router.route('/:branchid/cover-upload-url')
    /**
     * @api {get} /:branchid/picture-upload-url Get Cover Upload URL
     * @apiName Get Cover Upload URL
     * @apiDescription Get a pre-signed URL to which a cover picture for the specified branch can be uploaded.
     * @apiGroup Branch
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
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
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, (req, res) => {
      controller.getPictureUploadUrl(req, res, 'cover');
    });

  router.route('/:branchid/picture')
    /**
     * @api {get} /:branchid/picture Get Picture
     * @apiName Get Picture
     * @apiDescription Get a pre-signed URL where the specified branch's profile picture can be accessed.
     * @apiGroup Branch
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      controller.getPicture(req, res, 'picture', false);
    });

  router.route('/:branchid/picture-thumb')
    /**
     * @api {get} /:branchid/picture-thumb Get Picture Thumbnail
     * @apiName Get Picture Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the specified branch's profile picture can be accessed.
     * @apiGroup Branch
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      controller.getPicture(req, res, 'picture', true);
    });

  router.route('/:branchid/cover')
    /**
     * @api {get} /:branchid/cover Get Cover
     * @apiName Get Cover
     * @apiDescription Get a pre-signed URL where the specified branch's cover picture can be accessed.
     * @apiGroup Branch
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      controller.getPicture(req, res, 'cover', false);
    });

  router.route('/:branchid/cover-thumb')
    /**
     * @api {get} /:branchid/cover Get Cover Thumbnail
     * @apiName Get Cover Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the specified branch's cover picture can be accessed.
     * @apiGroup Branch
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "<url>"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res) => {
      controller.getPicture(req, res, 'cover', true);
    });

  router.route('/:branchid/subbranches')
    /**
     * @api {get} /:branchid/subbranches?timeafter=<timeafter> Get Child Branches
     * @apiName Get Child Branches
     * @apiDescription Get the child branches of the specified branch
     * @apiGroup Branch
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (Query Parameters) {Number} timeafter Only fetch child branches created after this time (UNIX timestamp)
     * @apiParam (Query Parameters) {String} lastBranchId The id of the last branch seen by the client. Results _after_ this branch will be returned, facilitating pagination.
     *
     * @apiSuccess (Successes) {String} data An array of child branch objects.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *      "message": "Success",
     *      "data": [
     *        {
     *          "parentid": "science",
     *          "id": "physics",
     *          "date": 1471641760077,
     *          "creator": "johndoe",
     *          "name": "Physics"
     *        },
     *        {
     *          "parentid": "science",
     *          "id": "chemistry",
     *          "date": 1471642069522,
     *          "creator": "johndoe",
     *          "name": "Chemistry"
     *        },
     *        {
     *          "parentid": "science",
     *          "id": "biology",
     *          "date": 1471642084414,
     *          "creator": "johndoe",
     *          "name": "Biology"
     *        }
     *      ]
     *    }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), controller.getSubbranches);

  router.route('/:branchid/modlog')
    /**
     * @api {get} /:branchid/modlog Get The Moderator Action Log
     * @apiName Get The Moderator Action Log
     * @apiDescription Get a list of actions performed by moderators on this branch
     * @apiGroup Branch
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiSuccess (Successes) {String} data An array of moderator action objects
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *      "message": "Success",
     *      "data": [
     *        {
     *          "username": "johndoe",
     *          "date": 1471868547062,
     *          "action": "answer-subbranch-request",
     *          "data": "{\"response\":\"accept\",\"childid\":\"physics\",\"parentid\":\"science\",\"childmod\":\"janedoe\"}",
     *          "branchid": "science"
     *        },
     *        {
     *          "username": "johndoe",
     *          "date": 1471868547062,
     *          "action": "answer-subbranch-request",
     *          "data": "{\"response\":\"reject\",\"childid\":\"physics\",\"parentid\":\"science\",\"childmod\":\"janedoe\"}",
     *          "branchid": "science"
     *        },
     *        {
     *          "username": "johndoe",
     *          "date": 1471958603485,
     *          "action": "addmod",
     *          "data": "james",
     *          "branchid": "science"
     *        }
     *      ]
     *    }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.getModLog);

  return router;
}
