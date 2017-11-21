'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

var BranchImage = function (data) {
  this.config = {
    keys: db.Keys.BranchImages,
    schema: db.Schema.BranchImages,
    table: db.Table.BranchImages,
  };
  this.data = this.sanitize(data);
  this.restricted = ['id'];
};

// UserPicture model inherits from Model
BranchImage.prototype = Object.create(Model.prototype);
BranchImage.prototype.constructor = BranchImage;

// Get a branch image of given type ('picture', 'cover') by it's id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no image entry found.
BranchImage.prototype.findById = function (id, type) {
  if (type !== 'picture' && type !== 'cover') {
    return Promise.reject();
  }

  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.get({
      Key: { id: `${id}-${type}` },
      TableName: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      
      if (!data || !data.Item) {
        return reject();
      }

      self.data = data.Item;
      
      return resolve(data.Item);
    });
  });
};

// Validate user picture object, returning an array of any invalid properties
BranchImage.prototype.validate = function () {
  const invalids = [];

  // check for valid id ending with -picture or -cover
  if (!this.data.id || (!this.data.id.endsWith('-picture') && !this.data.id.endsWith('-cover'))) {
    invalids.push('id');
  }

  // check for valid date
  if (!validate.date(this.data.date)) {
    invalids.push('date');
  }

  // check for valid extension
  if (!validate.extension(this.data.extension)) {
    invalids.push('extension');
  }

  return invalids;
};

module.exports = BranchImage;
