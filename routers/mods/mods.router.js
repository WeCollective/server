'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./mods.controller.js');

  // branch moderators
  router.route('/')
    /**
     * @api {get} /branch/:branchid/mods Get Branch Mods
     * @apiName Get Branch Mods
     * @apiGroup Mods
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(controller.get)
    /**
     * @api {post} /branch/:branchid/mods Add Branch Mod
     * @apiName Add Branch Mod
     * @apiGroup Mods
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (Body Parameters) {String} username New moderator's username.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .post(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.post)

  router.route('/:username')
    /**
     * @api {delete} /branch/:branchid/mods/:username Delete Branch Mod
     * @apiName Delete Branch Mod
     * @apiDescription Delete a moderator of a branch. A moderator can only remove mods who were added after themselves.
     * @apiGroup Mods
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} username Moderator username
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .delete(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.delete);

  return router;
}
