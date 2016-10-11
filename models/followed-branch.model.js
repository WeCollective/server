'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var FollowedBranch = function(data) {
  this.config = {
    schema: db.Schema.FollowedBranch,
    table: db.Table.FollowedBranches,
    keys: db.Keys.FollowedBranches
  };
  this.data = this.sanitize(data);
};

// FollowedBranch model inherits from Model
FollowedBranch.prototype = Object.create(Model.prototype);
FollowedBranch.prototype.constructor = FollowedBranch;

// Validate the properties specified in 'properties' on the FollowedBranch object,
// returning an array of any invalid ones
FollowedBranch.prototype.validate = function(properties) {
  var invalids = [];

  // ensure username is valid username
  if(properties.indexOf('username') > -1) {
    if(!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  // ensure branchid exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  return invalids;
};

// Get a FollowedBranch by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
FollowedBranch.prototype.findByUsername = function(username) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "username = :username",
      ExpressionAttributeValues: {
        ":username": username
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
};

module.exports = FollowedBranch;
