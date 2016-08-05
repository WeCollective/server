'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var PostData = function(data) {
  this.config = {
    schema: db.Schema.PostData,
    table: db.Table.PostData,
    keys: db.Keys.PostData
  };
  this.data = this.sanitize(data);
};

// PostData model inherits from Model
PostData.prototype = Object.create(Model.prototype);
PostData.prototype.constructor = PostData;

// Validate the properties specified in 'properties' on the PostData object,
// returning an array of any invalid ones
PostData.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure creator is valid username
  if(properties.indexOf('creator') > -1) {
    if(!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  // ensure title is valid
  if(properties.indexOf('title') > -1) {
    if(!this.data.title || this.data.title.length < 1 || this.data.title.length > 300) {
      invalids.push('title');
    }
  }

  // ensure text is valid
  if(properties.indexOf('text') > -1) {
    if(!this.data.text || this.data.text.length < 1 || this.data.text.length > 20000) {
      invalids.push('text');
    }
  }

  return invalids;
};

// Get a post' data by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no post found.
PostData.prototype.findById = function(id) {
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

module.exports = PostData;
