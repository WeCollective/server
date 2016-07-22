'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var SubBranchRequest = require('../../models/subbranch-request.model.js');
var Branch = require('../../models/branch.model.js');
var ModLogEntry = require('../../models/mod-log-entry.model.js');

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
        // save the request to the database
        subbranchRequest.save().then(function () {
          // save a mod log entry describing the filing of the request
          var entry = new ModLogEntry({
            branchid: req.params.childid,     // child branch
            username: req.user.username,      // child mod
            date: new Date().getTime(),
            action: 'make-subbranch-request',
            data: req.params.branchid         // parent branch
          });

          var propertiesToCheck = ['branchid', 'username', 'date', 'action', 'data'];
          var invalids = entry.validate(propertiesToCheck);
          if(invalids.length > 0) {
            console.error('Error saving mod log entry.');
            return error.InternalServerError(res);
          }
          return entry.save();
        }).then(function () {
          return success.OK(res);
        }).catch(function(err) {
          console.error("Error saving subbranch request and mod log entry.");
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

      // create promise to delete the subbranch request
      var deletePromise = subbranchRequest.delete({
        parentid: req.params.branchid,
        childid: req.params.childid
      });

      // create an mod log entry for the parent branch describing the
      // action taken on the subbranch request
      var entryParent = new ModLogEntry({
        branchid: req.params.branchid,     // parent branch
        username: req.user.username,       // parent mod
        date: new Date().getTime(),
        action: 'answer-subbranch-request',
        data: JSON.stringify({
          response: req.body.action,       // 'accept' or 'reject'
          childid: req.params.childid,     // child branch id
          parentid: req.params.branchid,   // parent branch id
          childmod: data[0].creator        // child mod username
        })
      });
      // create an mod log entry for the child branch describing the
      // action taken on the subbranch request
      var entryChild = new ModLogEntry({
        branchid: req.params.childid,      // parent branch
        username: req.user.username,       // parent mod
        date: new Date().getTime(),
        action: 'answer-subbranch-request',
        data: JSON.stringify({
          response: req.body.action,       // 'accept' or 'reject'
          childid: req.params.childid,     // child branch id
          parentid: req.params.branchid,   // parent branch id
          childmod: data[0].creator        // child mod username
        })
      });
      var propertiesToCheck = ['branchid', 'username', 'date', 'action', 'data'];
      var invalidsParent = entryParent.validate(propertiesToCheck);
      var invalidsChild = entryChild.validate(propertiesToCheck);
      if(invalidsParent.length > 0 || invalidsChild.length > 0) {
        console.error('Error saving mod log entry.');
        return error.InternalServerError(res);
      }


      // Accept the request:
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
          // save the child mod log entry
          return entryChild.save();
        }).then(function() {
          // save the parent mod log entry
          return entryParent.save();
        }).then(function() {
          return success.OK(res);
        }).catch(function() {
          console.error("Error accepting request.");
          return error.InternalServerError(res);
        });
      // Reject the request:
      } else {
        // delete the request from the table
        deletePromise.then(function() {
          // save the child mod log entry
          return entryChild.save();
        }).then(function() {
          // save the parent mod log entry
          return entryParent.save();
        }).then(function() {
          return success.OK(res);
        }).catch(function() {
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
