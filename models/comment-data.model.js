'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var CommentData = function(data) {
  this.config = {
    schema: db.Schema.CommentData,
    table: db.Table.CommentData,
    keys: db.Keys.CommentData
  };
  this.data = this.sanitize(data);
};

// CommentData model inherits from Model
CommentData.prototype = Object.create(Model.prototype);
CommentData.prototype.constructor = CommentData;

// Validate the properties specified in 'properties' on the CommentData object,
// returning an array of any invalid ones
CommentData.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.commentid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure creator is valid username
  if(properties.indexOf('creator') > -1) {
    if(!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  // ensure text is valid
  if(properties.indexOf('text') > -1) {
    if(!this.data.text || this.data.text.length < 1 || this.data.text.length > 20000) {
      invalids.push('text');
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

// Get a comment's data by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no post found.
CommentData.prototype.findById = function(id) {
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

module.exports = CommentData;
