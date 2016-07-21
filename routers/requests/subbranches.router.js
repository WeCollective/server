'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./subbranches.controller.js');

  // get subbranch requests
  router.route('/')
    .get(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.get);

  // create and update a subbranch request
  router.route('/:childid')
    .post(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.childid)(req, res, next);
    }, controller.post)
    .put(function(req, res, next) {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.put);

  return router;
}
