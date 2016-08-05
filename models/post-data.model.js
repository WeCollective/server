'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

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
    if(!this.data.id || this.data.id.length < 1 || this.data.id.length > 45) {
      invalids.push('id');
    }
    // ensure id contains no whitespace
    if(/\s/g.test(this.data.id)) {
      invalids.push('id');
    }
    // ensure id is lowercase
    if((typeof this.data.id === 'string' || this.data.id instanceof String) &&
        this.data.id != this.data.id.toLowerCase()) {
      invalids.push('id');
    }
  }

  // ensure creator is valid username
  if(properties.indexOf('creator') > -1) {
    // ensure creator length is over 1 char and less than 20
    if(!this.data.creator ||
        this.data.creator.length < 1 || this.data.creator.length > 20) {
      invalids.push('creator');
    }
    // ensure creator contains no whitespace
    if(/\s/g.test(this.data.creator)) {
      invalids.push('creator');
    }
    // ensure username is lowercase
    if((typeof this.data.creator === 'string' || this.data.creator instanceof String) &&
        this.data.creator != this.data.creator.toLowerCase()) {
      invalids.push('creator');
    }
    // ensure username is not one of the banned words
    // (these words are used in user image urls and routes)
    var bannedUsernames = ['me', 'orig', 'picture', 'cover'];
    if(bannedUsernames.indexOf(this.data.creator) > -1) {
      invalids.push('creator');
    }
    // ensure username is not only numeric
    if(Number(this.data.creator)) {
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
