'use strict';

var express = require('express');
var router = express.Router({ mergeParams: true });
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./branch-posts.controller.js');

  router.route('/')
    // get all posts on the branch
    .get(controller.get);

  router.route('/:postid')
    // get a specific post on the branch
    .get(controller.getPost)
    // vote on a post
    .put(ACL.validateRole(ACL.Roles.AuthenticatedUser), controller.put);

  return router;
}
