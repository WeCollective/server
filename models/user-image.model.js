'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

var UserImage = function(data) {
  this.config = {
    schema: db.Schema.UserImages,
    table: db.Table.UserImages,
    keys: db.Keys.UserImages
  };
  this.data = this.sanitize(data);
};

// UserPicture model inherits from Model
UserImage.prototype = Object.create(Model.prototype);
UserImage.prototype.constructor = UserImage;

// Validate user picture object, returning an array of any invalid properties
UserImage.prototype.validate = function() {
  var invalids = [];

  return invalids;
};

module.exports = UserImage;
