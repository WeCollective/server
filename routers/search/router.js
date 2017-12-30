const express = require('express');
const reqlib = require('app-root-path').require;

// const ACL = reqlib('config/acl');
// const error = reqlib('responses/errors');
const passport = reqlib('config/passport')();

const router = express.Router();

module.exports = () => {
  const controller = require('./controller');

  router.route('/')
    /**
     * @api {get} /search Search query.
     * @apiName Search query
     * @apiGroup Search
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (Query Parameters) {String} query Search query
     *
     * @apiSuccess (Successes) {Object} data An object containing results array with matched items.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *    {
     *      "message": "Success",
     *      "data": {
     *        "results": [],
     *      }
     *    }
     *
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), controller.search);

  return router;
}
