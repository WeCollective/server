'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

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
    if(!this.data.branchid || this.data.branchid.length < 1 || this.data.branchid.length > 30) {
      invalids.push('branchid');
    }
    // ensure branchid contains no whitespace
    if(/\s/g.test(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  if(properties.indexOf('username') > -1) {
    // ensure username length is over 1 char and less than 20
    if(!this.data.username ||
        this.data.username.length < 1 || this.data.username.length > 20) {
      invalids.push('username');
    }
    // ensure username contains no whitespace
    if(/\s/g.test(this.data.username)) {
      invalids.push('username');
    }
    // ensure username is not one of the banned words
    // (these words are used in user image urls and routes)
    var bannedUsernames = ['me', 'orig', 'picture', 'cover'];
    if(bannedUsernames.indexOf(this.data.username) > -1) {
      invalids.push('username');
    }
    // ensure username is not only numeric
    if(Number(this.data.username)) {
      invalids.push('username');
    }
  }

  if(properties.indexOf('date') > -1) {
    // check for valid date joined
    if(!this.data.date || !Number(this.data.date) > 0) {
      invalids.push('date');
    }
  }

  // action and data must be checked whether specified or not
  if(!this.data.action || (this.data.action != 'addmod' && this.data.action != 'removemod')) {
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
