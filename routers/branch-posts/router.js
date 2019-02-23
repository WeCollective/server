const express = require('express');
const reqlib = require('app-root-path').require;

const ACL = reqlib('config/acl');
const router = express.Router({ mergeParams: true });

module.exports = () => {
  const controller = require('./controller');

  router.route('/')
    /**
     * @api {get} /branch/:branchid/posts?timeafter=<timeafter>&stat=<stat>&postType=<postType>&sortBy=<sortBy> Get Branch Posts
     * @apiName Get Branch Posts
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (Query Parameters) {Number} timeafter Only fetch posts created after this time (UNIX timestamp). [optional; default 0]
     * @apiParam (Query Parameters) {String} stat The stat type to sort the posts by ['global', 'local', 'individual'] [optional; default 'individual']
     * @apiParam (Query Parameters) {String} flag Boolean indicating whether to only fetched flagged posts
     * @apiParam (Query Parameters) {String} postType String indicating the type of post to fetch ['all', 'text', 'image', 'page', 'video', 'audio', 'poll']
     * @apiParam (Query Parameters) {String} sortBy String indicating how to sort the results ['date, 'points']
     * @apiParam (Query Parameters) {String} flag Boolean indicating whether to only fetched flagged posts
     * @apiParam (Query Parameters) {String} lastPostId The id of the last post seen by the client. Results _after_ this post will be returned, facilitating pagination.
     *
     * @apiSuccess (Successes) {String} data An array of post objects.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": [
     *         {
     *           "id": "johndoe-1471868592207",
     *           "date": 1471868592207,
     *           "individual": 0,
     *           "branchid": "science",
     *           "type": "text"
     *         },
     *         {
     *          "id": "johndoe-1471630511498",
     *          "date": 1471630511498,
     *          "individual": 0,
     *          "branchid": "science",
     *          "type": "video"
     *        },
     *        {
     *          "id": "johndoe-1471889497552",
     *          "date": 1471889497552,
     *          "individual": 0,
     *          "branchid": "science",
     *          "type": "image"
     *        }
     *      ]
     *    }
     *
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.get);

  router.route('/:postid')
    /**
     * @api {get} /branch/:branchid/posts/:postid Get Post on Branch
     * @apiName Get Post on Branch
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiSuccess (Successes) {String} data An array containing a single post object
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": [
     *          {
     *            "id": "johndoe-1471630511498",
     *            "down": 0,
     *            "individual": 0,
     *            "branchid": "science",
     *            "comment_count": 0,
     *            "local": 0,
     *            "date": 1471630511498,
     *            "up": 0,
     *            "type": "video"
     *          }
     *       ]
     *    }
     *
     *
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getPost)

    /**
     * @api {put} /branch/:branchid/posts/:postid Vote on Post
     * @apiName Vote on Post
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (Body Parameters) {String} vote Vote direction ['up', 'down']
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .put(ACL.allow(ACL.Roles.User), controller.postVote);

  router.route('/:postid/resolve')
    /**
     * @api {post} /branch/:branchid/posts/:postid/resolve Resolve the flags on a Post
     * @apiName Resolve the flags on a Post
     * @apiGroup Posts
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiParam (Body Parameters) {String} action The action to take to resolve the post. One of: change_type, remove, approve, mark_nsfw
     * @apiParam (Body Parameters) {String} type Required iff. action=change_type. The new type of the post
     * @apiParam (Body Parameters) {String} reason Required iff. action=remove. One of: site_rules, branch_rules
     * @apiParam (Body Parameters) {String} message Required iff. action=remove. An explanatory reason to send to the OP for why the post is being removed.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .post((req, res, next) => ACL.allow(ACL.Roles.Moderator, req.params.branchid)(req, res, next), controller.resolveFlag);

  return router;
};
