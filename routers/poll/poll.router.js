'use strict';

var express = require('express');
var router = express.Router();
var ACL = require('../../config/acl.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = function(app, passport) {
  var controller = require('./poll.controller.js');

  router.route('/:postid/answer')
    /**
     * @api {poll} /:postid/answer Create an answer for a poll
     * @apiName Create Poll Answer
     * @apiGroup Polls
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (Body Parameters) {String} postid Id of the post (of type=poll) that the Answer belongs to
     * @apiParam (Body Parameters) {String} text The textual description of the Answer
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .post(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.post);

  return router;
}
