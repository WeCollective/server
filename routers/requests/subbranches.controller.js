'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var SubBranchRequest = require('../../models/subbranch-request.model.js');
var Branch = require('../../models/branch.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  // TODO: add an entry to the mod log
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
  },
  // TODO: add an entry to the mod log
  put: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    if(!req.body.action || (req.body.action != 'accept' && req.body.action != 'reject')) {
      return error.BadRequest(res, 'Missing or malformed action parameter');
    }

    // first ensure the request exists
    var subbranchRequest = new SubBranchRequest();
    subbranchRequest.find(req.params.branchid, req.params.childid).then(function(data) {
      if(!data || data.length == 0) {
        return error.NotFound(res);
      }

      var deletePromise = subbranchRequest.delete({
        parentid: req.params.branchid,
        childid: req.params.childid
      });

      if(req.body.action == 'accept') {
        // update the child branch's parentid
        var updatedBranch = new Branch({
          id: req.params.childid
        });
        updatedBranch.set('parentid', req.params.branchid);
        updatedBranch.update().then(function () {
          // delete the request from the table
          return deletePromise;
        }).then(function() {
          return success.OK(res);
        }).catch(function() {
          console.error("Error accepting request.");
          return error.InternalServerError(res);
        });
      } else {
        // delete the request from the table
        deletePromise.then(function () {
          return success.OK(res);
        }, function() {
          console.error("Error rejecting request.");
          return error.InternalServerError(res);
        });
      }
    }, function(err) {
      if(err) {
        console.error("Error fetching subbranch request.");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
