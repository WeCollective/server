'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const Vote = function (data) {
  this.config = {
    keys: db.Keys.UserVotes,
    schema: db.Schema.UserVote,
    table: db.Table.UserVotes,
  };
  this.data = this.sanitize(data);
};

// Vote model inherits from Model
Vote.prototype = Object.create(Model.prototype);
Vote.prototype.constructor = Vote;

Vote.prototype.findByUsernameAndItemId = function (username, itemid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':itemid': itemid,
        ':username': username,
      },
      KeyConditionExpression: 'username = :username AND itemid = :itemid',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items || data.Items.length === 0) {
        return resolve();
      }

      self.data = data.Items[0];
      return resolve(self.data);
    });
  });
};

// Validate the properties specified in 'properties' on the Vote object,
// returning an array of any invalid ones
Vote.prototype.validate = function (props) {
  const invalids = [];

  if (props.includes('direction')) {
    if (this.data.direction !== 'up' && this.data.direction !== 'down') {
      invalids.push('direction');
    }
  }

  if (props.includes('username')) {
    if (!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  return invalids;
};

module.exports = Vote;
