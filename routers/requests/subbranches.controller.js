'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var SubBranchRequest = require('../../models/subbranch-request.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  post: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // create new subbranch request
    var subbranchRequest = new SubBranchRequest({
      parentid: req.params.branchid,
      childid: req.params.childid,
      date: new Date().getTime(),
      creator: req.user.username
    });

    // validate request properties
    var propertiesToCheck = ['parentid', 'childid', 'date', 'creator'];
    var invalids = subbranchRequest.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // check this request does not already exist
    subbranchRequest.find(subbranchRequest.data.parentid,
                          subbranchRequest.data.childid).then(function(response) {
      if(!response || response.length == 0) {
        subbranchRequest.save().then(function () {
          return success.OK(res);
        }, function () {
          console.error("Unable to save subbranch request.");
          return error.InternalServerError(res);
        });
      } else {
        return error.BadRequest(res, 'Request already exists');
      }
    }, function (err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  get: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    var subbranchRequest = new SubBranchRequest();
    subbranchRequest.findByBranch(req.params.branchid).then(function(response) {
      return success.OK(res, response);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
