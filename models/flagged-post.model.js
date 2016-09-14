'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var _ = require('lodash');

var FlaggedPost = function(data) {
  this.config = {
    schema: db.Schema.FlaggedPost,
    table: db.Table.FlaggedPosts,
    keys: db.Keys.FlaggedPosts
  };
  this.data = this.sanitize(data);
};

// FlaggedPost model inherits from Model
FlaggedPost.prototype = Object.create(Model.prototype);
FlaggedPost.prototype.constructor = FlaggedPost;

// Validate the properties specified in 'properties' on the FlaggedPost object,
// returning an array of any invalid ones
FlaggedPost.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure branchid exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure type is valid
  if(properties.indexOf('type') > -1) {
    if(this.data.type != 'text' && this.data.type != 'page' &&
       this.data.type != 'image' && this.data.type != 'audio' &&
       this.data.type != 'video') {
      invalids.push('type');
    }
  }

  // ensure flag counts are valid numbers
  if(properties.indexOf('branch_rules_count') > -1) {
    if(isNaN(this.data.branch_rules_count)) {
      invalids.push('branch_rules_count');
    }
  }
  if(properties.indexOf('site_rules_count') > -1) {
    if(isNaN(this.data.site_rules_count)) {
      invalids.push('site_rules_count');
    }
  }
  if(properties.indexOf('wrong_type_count') > -1) {
    if(isNaN(this.data.wrong_type_count)) {
      invalids.push('wrong_type_count');
    }
  }

  return invalids;
};

// Get a flaggedpost by its id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
FlaggedPost.prototype.findById = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": id
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

FlaggedPost.prototype.findByPostAndBranchIds = function(postid, branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "id = :postid AND branchid = :branchid",
      ExpressionAttributeValues: {
        ":postid": postid,
        ":branchid": branchid
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items || data.Items.length == 0) {
        return reject();
      }
      self.data = data.Items[0];
      return resolve();
    });
  });
};

module.exports = FlaggedPost;
