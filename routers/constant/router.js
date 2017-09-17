'use strict';

const express = require('express');
const router = express.Router();
const ACL = require('../../config/acl');
const success = require('../../responses/successes');

module.exports = app => {
  const controller = require('./controller');

  router.route('/:id')
    /**
     * @api {get} /constant/:id Get a global constant
     * @apiName Get a global constant
     * @apiGroup Constants
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} id The id of the constant to fetch
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(controller.get)
    /**
     * @api {put} /constant/:id Update a global constant
     * @apiName Update a global constant
     * @apiGroup Constants
     * @apiPermission admin
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} id The id of the constant to update
     *
     * @apiParam (Body Parameters) {String} data The new value of the constant
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .put(ACL.validateRole(ACL.Roles.Admin), controller.put);

  return router;
};
