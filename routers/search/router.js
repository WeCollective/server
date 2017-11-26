const express = require('express');

// const ACL = require('../../config/acl');
// const error = require('../../responses/errors');
const passport = require('../../config/passport')();

const router = express.Router();

module.exports = () => {
  const controller = require('./controller');

  router.route('/')
    /**
     * @api {post} /post Create Post
     * @apiName Create Post
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (Body Parameters) {String} title Post title
     * @apiParam (Body Parameters) {String[]} branchids Array of unique branch ids to which the post should be tagged. The post will also be tagged to all branches which appear above these branches.
     * @apiParam (Body Parameters) {String} type The post type ['text', 'image', 'video', 'audio', 'page']
     * @apiParam (Body Parameters) {String} text The post's body of text (for 'text' types) or the URL of the resource (for all other types)
     *
     * @apiSuccess (Successes) {String} data The generated id for the new post
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": "postid"
     *    }
     *
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), controller.search);

  return router;
}
