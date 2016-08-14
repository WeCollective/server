'use strict';

var express = require('express');
var router = express.Router();
var ACL = require('../../config/acl.js');

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

  return router;
}
