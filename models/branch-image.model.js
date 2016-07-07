'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

var BranchImage = function(data) {
  this.config = {
    schema: db.Schema.BranchImages,
    table: db.Table.BranchImages,
    keys: db.Keys.BranchImages
  };
  this.restricted = ['id'];
  this.data = this.sanitize(data);
};

// UserPicture model inherits from Model
BranchImage.prototype = Object.create(Model.prototype);
BranchImage.prototype.constructor = BranchImage;

// Validate user picture object, returning an array of any invalid properties
BranchImage.prototype.validate = function() {
  var invalids = [];

  // check for valid id ending with -picture or -cover
  if(!this.data.id || (!this.data.id.endsWith('-picture') && !this.data.id.endsWith('-cover'))) {
    invalids.push('id');
  }

  // check for valid date
  if(!this.data.date || !Number(this.data.date) > 0) {
    invalids.push('date');
  }

  // check for valid extension
  var extensions = ['jpg', 'JPG', 'jpe', 'JPE', 'jpeg', 'JPEG', 'png', 'PNG', 'bmp', 'BMP'];
  if(extensions.indexOf(this.data.extension) == -1) {
    invalids.push(this.data.extension);
  }

  return invalids;
};

// Get a branch image of given type ('picture', 'cover') by it's id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no image entry found.
BranchImage.prototype.findById = function(id, type) {
  if(type != 'picture' && type != 'cover') {
    return reject();
  }

  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'id': id + '-' + type
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

module.exports = BranchImage;
