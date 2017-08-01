'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const CommentData = function (data) {
  this.config = {
    keys: db.Keys.CommentData,
    schema: db.Schema.CommentData,
    table: db.Table.CommentData,
  };
  this.data = this.sanitize(data);
};

// CommentData model inherits from Model
CommentData.prototype = Object.create(Model.prototype);
CommentData.prototype.constructor = CommentData;

// Get a comment's data by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no post found.
CommentData.prototype.findById = function (id) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.get({
      Key: { id },
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Item) {
        return reject();
      }

      self.data = data.Item;
      return resolve(self.data);
    });
  });
};

// Validate the properties specified in 'properties' on the CommentData object,
// returning an array of any invalid ones
CommentData.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'creator',
      'date',
      'edited',
      'id',
      'text',
    ];
  }

  const invalids = [];

  if (properties.includes('creator')) {
    if (!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  if (properties.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  if (properties.includes('edited')) {
    if (this.data.edited !== undefined && this.data.edited !== true && this.data.edited !== false) {
      invalids.push('edited');
    }
  }

  if (properties.includes('id')) {
    if (!validate.commentid(this.data.id)) {
      invalids.push('id');
    }
  }

  if (properties.includes('text')) {
    if (!this.data.text || this.data.text.length < 1 || this.data.text.length > 20000) {
      invalids.push('text');
    }
  }

  return invalids;
};

module.exports = CommentData;
