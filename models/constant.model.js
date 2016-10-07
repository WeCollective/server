'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var Constant = function(data) {
  this.config = {
    schema: db.Schema.Constant,
    table: db.Table.Constants,
    keys: db.Keys.Constants
  };
  this.data = this.sanitize(data);
};

// Constant model inherits from Model
Constant.prototype = Object.create(Model.prototype);
Constant.prototype.constructor = Constant;

// Validate the properties specified in 'properties' on the Constant object,
// returning an array of any invalid ones
Constant.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists
  if(properties.indexOf('id') > -1) {
    if(!validate.wecoConstantId(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure data is of correct type
  if(properties.indexOf('data') > -1) {
    if(!validate.wecoConstantValue(this.data.id, this.data.data)) {
      invalids.push('data');
    }
  }

  return invalids;
};

// Get a Constant by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no constant found.
Constant.prototype.findById = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'id': id
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

module.exports = Constant;
