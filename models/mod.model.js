'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const Mod = function (data) {
  this.config = {
    keys: db.Keys.Mods,
    schema: db.Schema.Mod,
    table: db.Table.Mods,
  };
  this.data = this.sanitize(data);
};

// User model inherits from Model
Mod.prototype = Object.create(Model.prototype);
Mod.prototype.constructor = Mod;

// Get the mods of a specific branch, passing results into resolve
// Rejects promise with true if database error, with false if no mods found.
Mod.prototype.findByBranch = function (branchid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':id': branchid,
      },
      KeyConditionExpression: 'branchid = :id',
      TableName: self.config.table,
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

// Validate the properties specified in 'properties' on the mod object,
// returning an array of any invalid ones
Mod.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'branchid',
      'date',
      'username',
    ];
  }

  const invalids = [];

  if (properties.includes('branchid')) {
    if (!validate.branchid(this.data.branchid)) {
      invalids.push('Invalid branchid.');
    }
  }

  if (properties.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('Invalid date.');
    }
  }

  if (properties.includes('username')) {
    if (!validate.username(this.data.username)) {
      invalids.push('Invalid username.');
    }
  }

  return invalids;
};

module.exports = Mod;
