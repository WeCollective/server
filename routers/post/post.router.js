'use strict';

var express = require('express');
var router = express.Router();
var ACL = require('../../config/acl.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = function(app, passport) {
  var controller = require('./post.controller.js');

  router.route('/')
    .post(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.post);

  router.route('/:postid')
    .get(controller.get);

  // get a presigned url for post image upload to s3
  router.route('/:postid/picture-upload-url')
    .get(ACL.validateRole(ACL.Roles.AuthenticatedUser), function(req, res) {
      controller.getPictureUploadUrl(req, res);
    });
  // get authd user profile picture presigned url
  router.route('/:postid/picture')
    .get(function(req, res) {
      controller.getPicture(req, res, false);
    });
  router.route('/:postid/picture-thumb')
    .get(function(req, res) {
      controller.getPicture(req, res, true);
    });


  // get root comments or create a new one
  router.route('/:postid/comments')
    .get(controller.getComments)
    .post(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.postComment);
  // get a particular comment's data
  router.route('/:postid/comments/:commentid')
    .get(controller.getComment)
    // update or vote on a comment
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), function(req, res) {
      if(req.body.vote) {
        controller.voteComment(req, res);
      } else if(req.body.text) {
        controller.putComment(req, res);
      } else {
        return error.BadRequest(res, 'Must specify either vote or text in body');
      }
    });

  return router;
}
