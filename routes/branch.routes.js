'use strict';

var aws = require('../config/aws.js');
var Branch = require('../models/branch.model.js');
var success = require('./responses/successes.js');
var error = require('./responses/errors.js');

module.exports = {
  postBranch: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.Forbidden(res);
    }

    var branch = new Branch({
      id: req.body.id,
      name: req.body.name,
      mods: [req.user.username],
      creator: req.user.username,
      date: new Date().getTime(),
      parentid: req.body.parentid
    });

    // validate branch properties
    var invalids = branch.validate();
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    branch.save().then(function() {
      return success.OK(res);
    }, function() {
      return error.InternalServerError(res);
    });
  },
  getSubbranches: function(req, res) {
    if(!req.params.parentid) {
      return error.BadRequest(res, 'Missing parentid');
    }

    var branch = new Branch();
    branch.findSubbranches(req.params.parentid).then(function(data) {
      return success.OK(res, data);
    }, function() {
      return error.InternalServerError(res);
    });
  }
};
