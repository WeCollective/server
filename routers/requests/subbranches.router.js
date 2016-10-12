'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./subbranches.controller.js');

  // get subbranch requests
  router.route('/')
    /**
     * @api {get} /branch/:branchid/requests/subbranches Get Child Branch Requests
     * @apiName Get Child Branch Requests
     * @apiGroup Requests
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiSuccess (Successes) {String} data An array of child branch request objects.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": [
     *         {
     *           "parentid": "science",
     *           "date": 1471961075596,
     *           "creator": "johndoe",
     *           "childid": "physics"
     *         }
     *      ]
     *    }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.get);

  router.route('/:childid')
    /**
     * @api {post} /branch/:branchid/requests/subbranches/:childid Create Child Branch Request
     * @apiName Create Child Branch Request
     * @apiGroup Requests
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} childid Child Branch unique id.
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .post(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.childid)(req, res, next);
    }, controller.post)
    /**
     * @api {put} /branch/:branchid/requests/subbranches/:childid Answer Child Branch Request
     * @apiName Answer Child Branch Request
     * @apiGroup Requests
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} childid Child Branch unique id.
     * @apiParam (Body Parameters) {String} action The action to take ['accept', 'reject']
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .put(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.put);

  return router;
}
