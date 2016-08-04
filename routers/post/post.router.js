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

  return router;
}
