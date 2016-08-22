'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var _ = require('lodash');

var Comment = function(data) {
  this.config = {
    schema: db.Schema.Comment,
    table: db.Table.Comments,
    keys: db.Keys.Comments
  };
  this.data = this.sanitize(data);
};

// Comment model inherits from Model
Comment.prototype = Object.create(Model.prototype);
Comment.prototype.constructor = Comment;

// Validate the properties specified in 'properties' on the Comment object,
// returning an array of any invalid ones
Comment.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.commentid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure postid exists and is of correct length
  if(properties.indexOf('postid') > -1) {
    if(!validate.postid(this.data.postid)) {
      invalids.push('postid');
    }
  }

  // ensure parentid exists and is of correct length
  if(properties.indexOf('parentid') > -1) {
    if(!validate.commentid(this.data.parentid)) {
      invalids.push('parentid');
    }
  }

  // ensure stats are valid numbers
  if(properties.indexOf('individual') > -1) {
    if(isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }
  if(properties.indexOf('up') > -1) {
    if(isNaN(this.data.up)) {
      invalids.push('up');
    }
  }
  if(properties.indexOf('down') > -1) {
    if(isNaN(this.data.down)) {
      invalids.push('down');
    }
  }
  if(properties.indexOf('rank') > -1) {
    if(isNaN(this.data.rank)) {
      invalids.push('rank');
    }
  }
  if(properties.indexOf('replies') > -1) {
    if(isNaN(this.data.replies)) {
      invalids.push('replies');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  return invalids;
};

// Get a comment by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Comment.prototype.findById = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'id': id
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Item) {
        return reject();
      }
      self.data = data.Item;
      return resolve();
    });
  });
};

Comment.prototype.findByParent = function(postid, parentid, sortBy) {
  var self = this;
  var index = self.config.keys.globalIndexes[0];
  switch(sortBy) {
    case 'points':
      index = self.config.keys.globalIndexes[0];
      break;
    case 'date':
      index = self.config.keys.globalIndexes[1];
      break;
    case 'replies':
      index = self.config.keys.globalIndexes[2];
      break;
  }

  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: index,
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      KeyConditionExpression: "postid = :postid",
      FilterExpression: "parentid = :parentid",
      ExpressionAttributeValues: {
        ":postid": postid,
        ":parentid": parentid
      },
      ScanIndexForward: false   // return results highest first
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      resolve(data.Items);
    });
  });
};

module.exports = Comment;
