'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./mods.controller.js');

  // branch moderators
  router.route('/')
    .get(controller.get)
    .post(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.post)
  router.route('/:username')
    .delete(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.delete);

  return router;
}
