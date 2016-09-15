'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./branch-posts.controller.js');

  router.route('/')
    /**
     * @api {get} /branch/:branchid/posts?timeafter=<timeafter>&stat=<stat> Get Branch Posts
     * @apiName Get Branch Posts
     * @apiGroup Posts
     * @apiPermission guest
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (Query Parameters) {Number} timeafter Only fetch posts created after this time (UNIX timestamp). [optional; default 0]
     * @apiParam (Query Parameters) {String} stat The stat type to sort the posts by ['global', 'local', 'individual'] [optional; default 'individual']
     *
     * @apiSuccess (Successes) {String} data An array of post objects.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": [
     *         {
     *           "id": "johndoe-1471868592207",
     *           "date": 1471868592207,
     *           "individual": 0,
     *           "branchid": "science",
     *           "type": "text"
     *         },
     *         {
     *          "id": "johndoe-1471630511498",
     *          "date": 1471630511498,
     *          "individual": 0,
     *          "branchid": "science",
     *          "type": "video"
     *        },
     *        {
     *          "id": "johndoe-1471889497552",
     *          "date": 1471889497552,
     *          "individual": 0,
     *          "branchid": "science",
     *          "type": "image"
     *        }
     *      ]
     *    }
     *
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(controller.get);

  router.route('/:postid')
    /**
     * @api {get} /branch/:branchid/posts/:postid Get Post on Branch
     * @apiName Get Post on Branch
     * @apiGroup Posts
     * @apiPermission guest
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiSuccess (Successes) {String} data An array containing a single post object
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": [
     *          {
     *            "id": "johndoe-1471630511498",
     *            "down": 0,
     *            "individual": 0,
     *            "branchid": "science",
     *            "comment_count": 0,
     *            "local": 0,
     *            "date": 1471630511498,
     *            "up": 0,
     *            "type": "video"
     *          }
     *       ]
     *    }
     *
     *
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(controller.getPost)

    /**
     * @api {put} /branch/:branchid/posts/:postid Vote on Post
     * @apiName Vote on Post
     * @apiGroup Posts
     * @apiPermission auth
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (Body Parameters) {String} vote Vote direction ['up', 'down']
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.put);

  router.route('/:postid/resolve')
    .post(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.resolveFlag);

  return router;
}
