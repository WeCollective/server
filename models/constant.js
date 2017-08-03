'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const Constant = function (data) {
  this.config = {
    keys: db.Keys.Constants,
    schema: db.Schema.Constant,
    table: db.Table.Constants,
  };
  this.data = this.sanitize(data);
};

// Constant model inherits from Model
Constant.prototype = Object.create(Model.prototype);
Constant.prototype.constructor = Constant;

// Get a Constant by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no constant found.
Constant.prototype.findById = function (id) {
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

// Validate the properties specified in 'properties' on the Constant object,
// returning an array of any invalid ones
Constant.prototype.validate = function (properties) {
  const invalids = [];

  if (properties.includes('data')) {
    if (!validate.wecoConstantValue(this.data.id, this.data.data)) {
      invalids.push('data');
    }
  }

  if (properties.includes('id')) {
    if (!validate.wecoConstantId(this.data.id)) {
      invalids.push('id');
    }
  }

  return invalids;
};

module.exports = Constant;
