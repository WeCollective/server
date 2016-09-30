'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var PostImage = function(data) {
  this.config = {
    schema: db.Schema.PostImages,
    table: db.Table.PostImages,
    keys: db.Keys.PostImages
  };
  this.restricted = ['id'];
  this.data = this.sanitize(data);
};

// UserPicture model inherits from Model
PostImage.prototype = Object.create(Model.prototype);
PostImage.prototype.constructor = PostImage;

// Validate user picture object, returning an array of any invalid properties
PostImage.prototype.validate = function() {
  var invalids = [];

  // check for valid id ending with -picture or -cover
  if(!this.data.id || (!this.data.id.endsWith('-picture'))) {
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

// Get a branch image of given type ('picture', 'cover') by it's id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no image entry found.
PostImage.prototype.findById = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'id': id + '-picture'
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Item) {
        return reject();
      }
      self.data = data.Item;
      return resolve(data.Item);
    });
  });
};

module.exports = PostImage;
