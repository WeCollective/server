'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const PostData = function (data) {
  this.config = {
    keys: db.Keys.PostData,
    schema: db.Schema.PostData,
    table: db.Table.PostData,
  };
  this.data = this.sanitize(data);
};

// PostData model inherits from Model
PostData.prototype = Object.create(Model.prototype);
PostData.prototype.constructor = PostData;

// Get a post' data by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no post found.
PostData.prototype.findById = function (id) {
  const self = this;

  return new Promise( (resolve, reject) => {
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

// Validate the properties specified in 'properties' on the PostData object,
// returning an array of any invalid ones
PostData.prototype.validate = function (properties, postType) {
  if (!properties || properties.length === 0) {
    properties = [
      'id',
      'creator',
      'title',
      'text',
      'original_branches',
    ];
  }

  const invalids = [];

  if (properties.includes('id')) {
    if (!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  if (properties.includes('creator')) {
    if (!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  if (properties.includes('title')) {
    if (!this.data.title || this.data.title.length < 1 || this.data.title.length > 300) {
      invalids.push('title');
    }
  }

  if (properties.includes('text')) {
    if ((postType !== 'poll' && (!this.data.text || this.data.text.length < 1)) ||
      (this.data.text && this.data.text.length > 20000)) {
      invalids.push('text');
    }
  }

  // Must be valid JSON array.
  if (properties.includes('original_branches')) {
    if (!this.data.original_branches || !this.data.original_branches.length) {
      invalids.push('original_branches');
    }
    else {
      try {
        JSON.parse(this.data.original_branches);
      }
      catch (err) {
        invalids.push('original_branches');
      }
    }
  }

  return invalids;
};

module.exports = PostData;
