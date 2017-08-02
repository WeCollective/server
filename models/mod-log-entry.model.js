'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const ModLogEntry = function (data) {
  this.config = {
    keys: db.Keys.ModLog,
    schema: db.Schema.ModLogEntry,
    table: db.Table.ModLog,
  };
  this.data = this.sanitize(data);
};

// ModLogEntry model inherits from Model
ModLogEntry.prototype = Object.create(Model.prototype);
ModLogEntry.prototype.constructor = ModLogEntry;

// Get a mod log by branch id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no log data found.
ModLogEntry.prototype.findByBranch = function (branchid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':id': branchid,
      },
      KeyConditionExpression: 'branchid = :id',
      // Newest results first.
      ScanIndexForward: false,
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

// Validate the properties specified in 'properties' on the ModLogEntry object,
// returning an array of any invalid ones
ModLogEntry.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'action',
      'branchid',
      'data',
      'date',
      'username',
    ];
  }

  const allowedActions = [
    'addmod',
    'answer-subbranch-request',
    'make-subbranch-request',
    'removemod',
  ];

  const invalids = [];

  // Action and data must be checked whether specified or not.
  if (!this.data.action || !allowedActions.includes(this.data.action)) {
    invalids.push('action');
  }

  if (properties.includes('branchid')) {
    if (!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  if (!this.data.data) {
    invalids.push('data');
  }

  if (properties.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  if (properties.includes('username')) {
    if (!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  return invalids;
};

module.exports = ModLogEntry;
