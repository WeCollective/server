const express = require('express');
const reqlib = require('app-root-path').require;

const ACL = reqlib('config/acl');
const router = express.Router();

module.exports = () => {
  const controller = require('./controller');

  router.route('/posts')
    /**
     * @api {get} /search get results from search
     * @apiName search weco
     * @apiGroup Search
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getposts);

  router.route('/branches')
    /**
     * @api {get} /search get results from search
     * @apiName search weco
     * @apiGroup Search
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getbranches);

  router.route('/users')
    /**
     * @api {get} /users get results from search
     * @apiName search weco
     * @apiGroup Search
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getusers);

  router.route('/')
    /**
     * @api {get} searches everything
     * @apiName search weco
     * @apiGroup Search
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getAll);

  return router;
};
