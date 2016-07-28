'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

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
    if(!this.data.branchid || this.data.branchid.length < 1 || this.data.branchid.length > 30) {
      invalids.push('branchid');
    }
    // ensure branchid contains no whitespace
    if(/\s/g.test(this.data.branchid)) {
      invalids.push('branchid');
    }
    // ensure branchid is lowercase
    if((typeof this.data.branchid === 'string' || this.data.branchid instanceof String) &&
        this.data.branchid != this.data.branchid.toLowerCase()) {
      invalids.push('branchid');
    }
  }

  // ensure tag exists and is of correct length
  if(properties.indexOf('tag') > -1) {
    if(!this.data.tag || this.data.tag.length < 1 || this.data.tag.length > 30) {
      invalids.push('tag');
    }
    // ensure tag contains no whitespace
    if(/\s/g.test(this.data.tag)) {
      invalids.push('tag');
    }
    // ensure tag is lowercase
    if((typeof this.data.tag === 'string' || this.data.tag instanceof String) &&
        this.data.tag != this.data.tag.toLowerCase()) {
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
      IndexName: self.config.keys.secondary.global,
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

module.exports = Tag;
