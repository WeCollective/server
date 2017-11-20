'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

let UserImage = function (data) {
  this.config = {
    keys: db.Keys.UserImages,
    schema: db.Schema.UserImages,
    table: db.Table.UserImages
  };
  this.restricted = ['id'];
  this.data = this.sanitize(data);
};

// UserPicture model inherits from Model
UserImage.prototype = Object.create(Model.prototype);
UserImage.prototype.constructor = UserImage;

// Validate user picture object, returning an array of any invalid properties
UserImage.prototype.validate = function () {
  let invalids = [];

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

// Get a user image of given type ('picture', 'cover') by their username from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no image entry found.
UserImage.prototype.findByUsername = function (username, type) {
  if ('picture' !== type && 'cover' !== type) {
    return Promise.reject();
  }

  const self = this;

  return new Promise( (resolve, reject) => {
    aws.dbClient.get({
      Key: { id: `${username}-${type}` },
      TableNaWme: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Item) {
        return reject();
      }

      self.data = data.Item;

      return resolve();
    });
  });
};

module.exports = UserImage;
