const express = require('express');
const reqlib = require('app-root-path').require;

const ACL = reqlib('config/acl');

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
    .post(ACL.allow(ACL.Roles.User), controller.post);

  router.route('/picture-suggestion')
    /**
     * @api {get} /post/:postid/picture-suggestion Get Picture URL
     * @apiName Get Picture URL
     * @apiDescription Get a suggested URL from the requested website.
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} url Website url.
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
    .get(ACL.allow(ACL.Roles.Guest), controller.getPictureUrlSuggestion);

  router.route('/:postid')
    /**
     * @api {get} /post/:postid Get Post
     * @apiName Get Post
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branch The unique branch id.
     * @apiParam (URL Parameters) {String} postid The unique id of the post
     *
     * @apiSuccess (Successes) {String} data The generated id for the new post
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": {
     *         "id": "johndoe-1471642545455",
     *         "down": 1,
     *         "individual": 1,
     *         "branchid": "science",
     *         "comment_count": 0,
     *         "local": 1,
     *         "date": 1471642545455,
     *         "up": 2,
     *         "type": "page",
     *         "data": {
     *           "text": "URL to resource",
     *           "id": "johndoe-1471642545455",
     *           "creator": "johndoe",
     *           "title": "Post Title"
     *         }
     *       }
     *    }
     *
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.get)
    /**
     * @api {delete} /post/:postid Delete Post
     * @apiName Delete Post
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid The unique id of the post
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse InternalServerError
     */
    .delete(ACL.allow(ACL.Roles.User), controller.delete);

  router.route('/:postid/picture-upload-url')
    /**
     * @api {get} /post/:postid/picture-upload-url Get Picture Upload URL
     * @apiName Get Picture Upload URL
     * @apiDescription Get a pre-signed URL to which a picture for the specified post can be uploaded.
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "URL"
     *  }
     *
     * @apiUse Forbidden
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.User), (req, res) => controller.getPictureUploadUrl(req, res));

  router.route('/:postid/picture')
    /**
     * @api {get} /post/:postid/picture Get Picture
     * @apiName Get Picture
     * @apiDescription Get a pre-signed URL where the specified post's picture can be accessed.
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "URL"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), (req, res, next) => controller.getPicture(req, res, next, false));

  router.route('/:postid/picture-thumb')
    /**
     * @api {get} /post/:postid/picture-thumb Get Picture Thumbnail
     * @apiName Get Picture Thumbnail
     * @apiDescription Get a pre-signed URL where the thumbnail for the specified post's picture can be accessed.
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiSuccess (Successes) {String} data The presigned URL.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": "URL"
     *  }
     *
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), (req, res, next) => controller.getPicture(req, res, next, true));

  router.route('/:postid/flag')
    /**
     * @api {post} /post/:postid/flag Flag post
     * @apiName Flag post
     * @apiDescription Flag a post to the branch moderators
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     *
     * @apiParam (Body Parameters) {String} flag_type The reason the post is being flagged. One of: branch_rules, site_rules, wrong_type, nsfw
     * @apiParam (Body Parameters) {String} branchid The id of the branch on which to flag the post
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .post(ACL.allow(ACL.Roles.User), controller.flagPost);

  router.route('/:postid/comments')
    /**
     * @api {get} /post/:postid/comments?parentid=<parentid>&sort=<sort> Get Comments
     * @apiName Get Comments
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (Query Parameters) {String} parentid The unique id of the parent comment (for root comments, parentid=none)
     * @apiParam (Query Parameters) {String} sort The metric by which to sort the comments ['points', 'replies', 'date']
     * @apiParam (Query Parameters) {String} lastCommentId The id of the last comment seen by the client. Results _after_ this comment will be returned, facilitating pagination.
     *
     * @apiSuccess (Successes) {String} data An array of comment objects.
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": [
     *      {
     *        "id": "johndoe-1471884687736",
     *        "down": 0,
     *        "individual": 1,
     *        "parentid": "none",
     *        "rank": 0,
     *        "date": 1471884687736,
     *        "up": 1,
     *        "postid": "johndoe-1471642545455",
     *        "replies": 0
     *      },
     *      {
     *        "id": "janedoe-1471884567072",
     *        "down": 0,
     *        "individual": 0,
     *        "parentid": "johndoe-1471884687736",
     *        "rank": 0,
     *        "date": 1471884567072,
     *        "up": 0,
     *        "postid": "johndoe-1471642545455",
     *        "replies": 2
     *      }
     *    ]
     *  }
     *
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getComments)

    /**
     * @api {post} /post/:postid/comments Create Comment
     * @apiName Create Comment
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (Body Parameters) {String} parentid Parent comment's unique id.
     * @apiParam (Body Parameters) {String} text Comment text
     *
     * @apiSuccess (Successes) {String} data The generated id for the new comment
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *     {
     *       "message": "Success",
     *       "data": "commentid"
     *    }
     *
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .post(ACL.allow(ACL.Roles.User), controller.postComment);

  router.route('/:postid/comments/:commentid')
    /**
     * @api {get} /post/:postid/comments/:commentid Delete Comment
     * @apiName Delete Comment
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (URL Parameters) {String} commentid Comment unique id
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .delete(ACL.allow(ACL.Roles.User), controller.deleteComment)

    /**
     * @api {get} /post/:postid/comments/:commentid Get Comment
     * @apiName Get Comment
     * @apiGroup Posts
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (URL Parameters) {String} commentid Comment unique id
     *
     * @apiSuccess (Successes) {String} data A single comment object
     * @apiSuccessExample {json} SuccessResponse:
     *  HTTP/1.1 200
     *  {
     *    "message": "Success",
     *    "data": {
     *      "id": "johndoe-1471884687736",
     *      "down": 0,
     *      "individual": 1,
     *      "parentid": "none",
     *      "rank": 0,
     *      "date": 1471884687736,
     *      "postid": "janedoe-1471642545455",
     *      "up": 1,
     *      "replies": 0,
     *      "data": {
     *        "text": "comment text",
     *        "id": "johndoe-1471884687736",
     *        "date": 1471884687736,
     *        "creator": "johndoe",
     *        "edited": false
     *      }
     *    }
     *  }
     *
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(ACL.allow(ACL.Roles.Guest), controller.getComment)

    /**
     * @api {put} /post/:postid/comments/:commentid Update/Vote Comment
     * @apiName Update/Vote Comment
     * @apiGroup Posts
     * @apiPermission auth
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} postid Post unique id.
     * @apiParam (URL Parameters) {String} commentid Comment unique id
     * @apiParam (Body Parameters) {String} vote Vote direction ['up', 'down'] [optional]
     * @apiParam (Body Parameters) {String} text Updated comment text [optional]
     *
     * @apiUse OK
     * @apiUse BadRequest
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .put(ACL.allow(ACL.Roles.User), (req, res, next) => {
      if (req.body.vote) {
        return controller.voteComment(req, res);
      }

      if (req.body.text) {
        return controller.editComment(req, res);
      }

      req.error = {
        message: 'Must specify either vote or text in body.',
        status: 400,
      };
      return next(JSON.stringify(req.error));
    });

  return router;
};
