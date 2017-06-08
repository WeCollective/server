'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

let PostData = function (data) {
  this.config = {
    keys: db.Keys.PostData,
    schema: db.Schema.PostData,
    table: db.Table.PostData
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
      TableName: self.config.table
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

// Validate the properties specified in 'props' on the PostData object,
// returning an array of any invalid ones
PostData.prototype.validate = function (props) {
  let invalids = [];

  // ensure id exists and is of correct length
  if (props.includes('id')) {
    if (!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure creator is valid username
  if (props.includes('creator')) {
    if (!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  // ensure title is valid
  if (props.includes('title')) {
    if (!this.data.title || this.data.title.length < 1 || this.data.title.length > 300) {
      invalids.push('title');
    }
  }

  // ensure text is valid
  if (props.includes('text')) {
    if (!this.data.text || this.data.text.length < 1 || this.data.text.length > 20000) {
      invalids.push('text');
    }
  }

  // ensure original_branches is a valid JSON array
  if (props.includes('original_branches')) {
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