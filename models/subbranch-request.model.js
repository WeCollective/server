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
