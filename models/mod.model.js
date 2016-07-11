'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

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
    if(!this.data.branchid || this.data.branchid.length < 1 || this.data.branchid.length > 30) {
      invalids.push('branchid');
    }
    // ensure id contains no whitespace
    if(/\s/g.test(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!this.data.date || !Number(this.data.date) > 0) {
      invalids.push('date');
    }
  }

  // TODO ensure username is existing + valid username
  if(properties.indexOf('username') > -1) {
    if(!this.data.username) {
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
      TableName: "devMods",
      KeyConditionExpression: "branchid = :id",
      ExpressionAttributeValues: {
        ":id": "abc"
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
