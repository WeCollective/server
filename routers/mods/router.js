const express = require('express');
const reqlib = require('app-root-path').require;

const ACL = reqlib('config/acl');
const passport = reqlib('config/passport')();

const router = express.Router({ mergeParams: true });

module.exports = () => {
  const controller = require('./controller');

  // branch moderators
  router.route('/')
    /**
     * @api {get} /branch/:branchid/mods Get Branch Mods
     * @apiName Get Branch Mods
     * @apiGroup Mods
     * @apiPermission guest
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse InternalServerError
     */
    .get(passport.authenticate('jwt'), controller.get)
    /**
     * @api {post} /branch/:branchid/mods Add Branch Mod
     * @apiName Add Branch Mod
     * @apiGroup Mods
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (Body Parameters) {String} username New moderator's username.
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .post(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.addModerator)

  router.route('/:username')
    /**
     * @api {delete} /branch/:branchid/mods/:username Delete Branch Mod
     * @apiName Delete Branch Mod
     * @apiDescription Delete a moderator of a branch. A moderator can only remove mods who were added after themselves.
     * @apiGroup Mods
     * @apiPermission mod
     * @apiVersion 1.0.0
     *
     * @apiParam (URL Parameters) {String} branchid Branch unique id.
     * @apiParam (URL Parameters) {String} username Moderator username
     *
     * @apiUse OK
     * @apiUse NotFound
     * @apiUse BadRequest
     * @apiUse Forbidden
     * @apiUse InternalServerError
     */
    .delete(passport.authenticate('jwt'), (req, res, next) => {
      ACL.validateRole(ACL.Roles.Moderator, req.params.branchid)(req, res, next);
    }, controller.removeModerator);

  return router;
}
