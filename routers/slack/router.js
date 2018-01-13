const express = require('express');
const reqlib = require('app-root-path').require;

const ACL = reqlib('config/acl');
const router = express.Router();

module.exports = () => {
  const controller = require('./controller');

  router.route('/')
    .post(ACL.allow(ACL.Roles.Guest), controller.command);

  return router;
};
