'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./branch-posts.controller.js');

  router.route('/')
    .get(controller.get);

  // vote on a post
  router.route('/:postid')
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.put);

  return router;
}
