'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var Tag = function(data) {
  this.config = {
    schema: db.Schema.Tag,
    table: db.Table.Tags,
    keys: db.Keys.Tags
  };
  this.data = this.sanitize(data);
};

// Tag model inherits from Model
Tag.prototype = Object.create(Model.prototype);
Tag.prototype.constructor = Tag;

// Validate the properties specified in 'properties' on the Tag object,
// returning an array of any invalid ones
Tag.prototype.validate = function(properties) {
  var invalids = [];

  // ensure branchid exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  // ensure tag exists and is of correct length
  if(properties.indexOf('tag') > -1) {
    if(!validate.branchid(this.data.tag)) {
      invalids.push('tag');
    }
  }

  return invalids;
};

// Get the tags of a specific branch, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Tag.prototype.findByBranch = function(branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "branchid = :id",
      ExpressionAttributeValues: {
        ":id": branchid
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

// Get the all the branches with a specific tag, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Tag.prototype.findByTag = function(tag) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.globalIndexes[0],
      KeyConditionExpression: "tag = :tag",
      ExpressionAttributeValues: {
        ":tag": tag
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

module.exports = Tag;
