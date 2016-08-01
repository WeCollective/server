'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

var SubBranchRequest = function(data) {
  this.config = {
    schema: db.Schema.SubBranchRequest,
    table: db.Table.SubBranchRequests,
    keys: db.Keys.SubBranchRequests
  };
  this.data = this.sanitize(data);
};

// SubBranchRequest model inherits from Model
SubBranchRequest.prototype = Object.create(Model.prototype);
SubBranchRequest.prototype.constructor = SubBranchRequest;

// Validate the properties specified in 'properties' on the branch object,
// returning an array of any invalid ones
SubBranchRequest.prototype.validate = function(properties) {
  var invalids = [];

  // ensure parentid exists and is of correct length
  if(properties.indexOf('parentid') > -1) {
    if(!this.data.parentid || this.data.parentid.length < 1 || this.data.parentid.length > 30) {
      invalids.push('parentid');
    }
    // ensure parentid contains no whitespace
    if(/\s/g.test(this.data.parentid)) {
      invalids.push('parentid');
    }
    // ensure parentid is lowercase
    if((typeof this.data.parentid === 'string' || this.data.parentid instanceof String) &&
        this.data.parentid != this.data.parentid.toLowerCase()) {
      invalids.push('parentid');
    }
    // ensure parentid is not root
    if(this.data.parentid == 'root') {
      invalids.push('parentid');
    }
  }

  // ensure childid exists and is of correct length
  if(properties.indexOf('childid') > -1) {
    if(!this.data.childid || this.data.childid.length < 1 || this.data.childid.length > 30) {
      invalids.push('childid');
    }
    // ensure childid contains no whitespace
    if(/\s/g.test(this.data.childid)) {
      invalids.push('childid');
    }
    // ensure id is lowercase
    if((typeof this.data.childid === 'string' || this.data.childid instanceof String) &&
        this.data.childid != this.data.childid.toLowerCase()) {
      invalids.push('childid');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!this.data.date || !Number(this.data.date) > 0) {
      invalids.push('date');
    }
  }

  // TODO ensure creator is valid username
  if(properties.indexOf('creator') > -1) {
    if(!this.data.creator) {
      invalids.push('creator');
    }
  }

  return invalids;
};


// Get a subbranch request by the parent and childs ids, passing data to resolve
// Rejects promise with true if database error, with false if no data found.
SubBranchRequest.prototype.find = function(parentid, childid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "parentid = :parentid and childid = :childid",
      ExpressionAttributeValues: {
        ":parentid": parentid,
        ":childid": childid
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

// Get the subbranch requests of a specific branch, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
SubBranchRequest.prototype.findByBranch = function(branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.secondary.global,
      KeyConditionExpression: "parentid = :id",
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

module.exports = SubBranchRequest;
