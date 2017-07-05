'use strict';

const _ = require('lodash');
const aws = require('../config/aws');
const db = require('../config/database');

// Model constructor
var Model = function() {
  if (this.constructor === Model) {
    throw new Error(`Can't instantiate abstract class!`);
  }
};

Model.prototype.config = {};      // model config inc. table name, schema, db keys
Model.prototype.data = {};      // the actual model data
Model.prototype.dirtys = [];      // array of changed model data properties

// Ensure data adheres to the schema
Model.prototype.sanitize = function (data, schema) {
  data = data || {};
  return _.pick(_.defaults(data, schema || this.config.schema), _.keys(schema || this.config.schema));
};

// Get/Set data on model
Model.prototype.get = function (name) {
  return this.data[name];
};

Model.prototype.set = function (name, value) {
  // update property value
  this.data[name] = value;

  // set dirty flag for this property
  if (!this.dirtys.includes(name)) {
    this.dirtys.push(name);
  }
};

// Save a new database entry according to the model data
Model.prototype.save = function () {
  const self = this;

  return new Promise( (resolve, reject) => {
    aws.dbClient.put({
      Item: self.data,
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
      return resolve();
    });
  });
};

// Delete the database entry specified by the model data
// The key should be the Primary key values identifying the object to be deleted
Model.prototype.delete = function (Key) {
  const self = this;

  return new Promise( (resolve, reject) => {
    // Construct key to identify the entry to be deleted if it isnt provided
    if (!Key) {
      Key = {};
      Key[self.config.keys.primary] = self.data[self.config.keys.primary];
      if (self.config.keys.sort) {
        Key[self.config.keys.sort] = self.data[self.config.keys.sort];
      }
    }

    aws.dbClient.delete({
      Key,
      TableName: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      self.data = self.sanitize({});
      return resolve();
    });
  });
};

// Update the existing database entry according to the model data
// The key should be the Primary key values identifying the object to be updated
Model.prototype.update = function (Key) {
  const self = this;

  return new Promise( (resolve, reject) => {
    // Construct key to identify the entry to be updated if it isnt provided
    if (!Key) {
      Key = {};
      Key[self.config.keys.primary] = self.data[self.config.keys.primary];
      if (self.config.keys.sort) {
        Key[self.config.keys.sort] = self.data[self.config.keys.sort];
      }
    }

    // Update the entry with values which have changed in the model
    let AttributeUpdates = {};
    for (let i = 0; i < self.dirtys.length; i++) {
      const name = self.dirtys[i];
      AttributeUpdates[name] = {
        Action: 'PUT',
        Value: self.data[name],
      }
    }

    // Perform the update
    aws.dbClient.update({
      AttributeUpdates,
      Key,
      TableName: self.config.table,
    }, err => {
      if (err) {
        return reject(err);
      }
      self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
      return resolve();
    });
  });
};

module.exports = Model;
