'use strict';

var express = require('express');
var router = express.Router();
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./branch.controller.js');

  router.route('/')
    .post(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.post);
  router.route('/:branchid')
    .get(controller.get)
    .put(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.put)
    .delete(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Admin)(req, res, next);
    }, controller.delete);
  // get presigned url for branch profile picture upload to S3
  router.route('/:branchid/picture-upload-url')
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, function(req, res) {
      controller.getPictureUploadUrl(req, res, 'picture');
    });
  // get presigned url for branch cover picture upload to S3
  router.route('/:branchid/cover-upload-url')
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, function(req, res) {
      controller.getPictureUploadUrl(req, res, 'cover');
    });
  // get branch profile picture presigned url
  router.route('/:branchid/picture')
    .get(function(req, res) {
      controller.getPicture(req, res, 'picture');
    });
  // get branch cover picture presigned url
  router.route('/:branchid/cover')
    .get(function(req, res) {
      controller.getPicture(req, res, 'cover');
    });
  // get child branches
  router.route('/:branchid/subbranches')
    .get(controller.getSubbranches);
  // get branch moderator log
  router.route('/:branchid/modlog')
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.getModLog);

  return router;
}
