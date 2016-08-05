'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var ModLogEntry = function(data) {
  this.config = {
    schema: db.Schema.ModLogEntry,
    table: db.Table.ModLog,
    keys: db.Keys.ModLog
  };
  this.data = this.sanitize(data);
};

// ModLogEntry model inherits from Model
ModLogEntry.prototype = Object.create(Model.prototype);
ModLogEntry.prototype.constructor = ModLogEntry;

// Validate the properties specified in 'properties' on the ModLogEntry object,
// returning an array of any invalid ones
ModLogEntry.prototype.validate = function(properties) {
  var invalids = [];

  // ensure branchid exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  if(properties.indexOf('username') > -1) {
    if(!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // action and data must be checked whether specified or not
  if(!this.data.action || (
      this.data.action != 'addmod' &&
      this.data.action != 'removemod' &&
      this.data.action != 'make-subbranch-request' &&
      this.data.action != 'answer-subbranch-request')) {
    invalids.push('action');
  }
  if(!this.data.data) {
    invalids.push('data');
  }

  return invalids;
};

// Get a mod log by branch id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no log data found.
ModLogEntry.prototype.findByBranch = function(branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "branchid = :id",
      ExpressionAttributeValues: {
        ":id": branchid
      },
      ScanIndexForward: false   // return results newest first
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
};

module.exports = ModLogEntry;
