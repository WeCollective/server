'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');
var ACL = require('../../config/acl.js');

// Models
var Constant = require('../../models/constant.model.js');

// Responses
var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

module.exports = {
  get: function(req, res) {
    if(!req.params.id) {
      return error.BadRequest(res, 'Missing id parameter');
    }

    // fetch the parameter
    var wecoConstant = new Constant();
    wecoConstant.findById(req.params.id).then(function() {
      return success.OK(res, wecoConstant.data);
    }).catch(function() {
      if(err) {
        console.error("Error fetching constant:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  put:  function(req, res) {
    if(!req.params.id) {
      return error.BadRequest(res, 'Missing id parameter');
    }
    if(!req.body.data) {
      return error.BadRequest(res, 'Missing data parameter');
    }

    // ensure constant exists
    var wecoConstant = new Constant();
    wecoConstant.findById(req.params.id).then(function() {
      // ensure correct type
      switch(req.params.id) {
        case 'donation_total':
        case 'raised_total':
        case 'user_count':
        case 'branch_count':
          req.body.data = Number(req.body.data);
          break;
      }

      // set the new value
      wecoConstant.set('data', req.body.data);

      // validate post properties
      var propertiesToCheck = ['id', 'data'];
      var invalids = wecoConstant.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }

      // update the constant
      return wecoConstant.update();
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error fetching constant:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
