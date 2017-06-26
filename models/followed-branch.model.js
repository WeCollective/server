'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

let FollowedBranch = function (data) {
  this.config = {
    keys: db.Keys.FollowedBranches,
    schema: db.Schema.FollowedBranch,
    table: db.Table.FollowedBranches
  };
  this.data = this.sanitize(data);
};

// FollowedBranch model inherits from Model
FollowedBranch.prototype = Object.create(Model.prototype);
FollowedBranch.prototype.constructor = FollowedBranch;

// Validate the properties specified in 'properties' on the FollowedBranch object,
// returning an array of any invalid ones
FollowedBranch.prototype.validate = function (properties) {
  let invalids = [];

  // ensure username is valid username
  if (properties.includes('username')) {
    if (!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  // ensure branchid exists and is of correct length
  if (properties.includes('branchid')) {
    if (!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  return invalids;
};

// Get a FollowedBranch by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
FollowedBranch.prototype.findByUsername = function (username) {
  const self = this;

  return new Promise( (resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: { ':username': username },
      KeyConditionExpression: 'username = :username',
      TableName: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      return resolve(data.Items);
    });
  });
};

module.exports = FollowedBranch;
