'use strict';

var express = require('express');
var router = express.Router();
var success = require('../../responses/successes.js');
var ACL = require('../../config/acl.js');

module.exports = function(app, passport) {
  var controller = require('./constant.controller.js');

  router.route('/:id')
    .get(controller.get)
    .put(ACL.validateRole(ACL.Roles.Admin), controller.put);

  return router;
};
