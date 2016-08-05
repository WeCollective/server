'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var Mod = function(data) {
  this.config = {
    schema: db.Schema.Mod,
    table: db.Table.Mods,
    keys: db.Keys.Mods
  };
  this.data = this.sanitize(data);
};

// User model inherits from Model
Mod.prototype = Object.create(Model.prototype);
Mod.prototype.constructor = Mod;

// Validate the properties specified in 'properties' on the mod object,
// returning an array of any invalid ones
Mod.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  if(properties.indexOf('username') > -1) {
    if(!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  return invalids;
};

// Get the mods of a specific branch, passing results into resolve
// Rejects promise with true if database error, with false if no mods found.
Mod.prototype.findByBranch = function(branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var params = {
      TableName: self.config.table,
      KeyConditionExpression: "branchid = :id",
      ExpressionAttributeValues: {
        ":id": branchid
      }
    };
    aws.dbClient.query(params, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
};

module.exports = Mod;
