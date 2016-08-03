'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var Post = require('../../models/post.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  get: function(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }
    // TODO: add support for different stats and time filters
    new Post().findByBranch(req.params.branchid).then(function(posts) {
      return success.OK(res, posts);
    }, function () {
      console.error('Error fetching posts on branch.');
      return error.InternalServerError(res);
    });
  }
};
