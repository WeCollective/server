'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var UserImage = function(data) {
  this.config = {
    schema: db.Schema.UserImages,
    table: db.Table.UserImages,
    keys: db.Keys.UserImages
  };
  this.restricted = ['id'];
  this.data = this.sanitize(data);
};

// UserPicture model inherits from Model
UserImage.prototype = Object.create(Model.prototype);
UserImage.prototype.constructor = UserImage;

// Validate user picture object, returning an array of any invalid properties
UserImage.prototype.validate = function() {
  var invalids = [];

  // check for valid id ending with -picture or -cover
  if(!this.data.id || (!this.data.id.endsWith('-picture') && !this.data.id.endsWith('-cover'))) {
    invalids.push('id');
  }

  // check for valid date
  if(!validate.date(this.data.date)) {
    invalids.push('date');
  }

  // check for valid extension
  if(!validate.extension(this.data.extension)) {
    invalids.push('extension');
  }

  return invalids;
};

// Get a user image of given type ('picture', 'cover') by their username from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no image entry found.
UserImage.prototype.findByUsername = function(username, type) {
  if(type != 'picture' && type != 'cover') {
    return reject();
  }

  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'id': username + '-' + type
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

module.exports = UserImage;
