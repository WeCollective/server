const express = require('express');
const reqlib = require('app-root-path').require;

const ACL = reqlib('config/acl');
const router = express.Router();

module.exports = () => {
  const controller = require('./controller');

  router.route('/')
    /**
     * @api {get} /scraper Scrap link for meta data to preview in the create post modal.
     * @apiName Scrap meta data.
     * @apiDescription Scraps the URL for any meta data we can display on the client.
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} url Website url (todo).
     *
     * @apiSuccess (Successes) {String} data The suggested picture URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "https://weco.io/picture.jpg"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.User), controller.scrap);

  return router;
};
