'use strict';

var db = require('../config/database.js');
var aws = require('../config/aws.js');
var _ = require('lodash');

// Model constructor
var Model = function() {
  if (this.constructor === Model) {
    throw new Error("Can't instantiate abstract class!");
  }
};

Model.prototype.data = {};        // the actual model data
Model.prototype.config = {};      // model config inc. table name, schema, db keys
Model.prototype.dirtys = [];      // array of model data properties which have been changed

// Ensure data adheres to the schema
Model.prototype.sanitize = function(data, schema) {
  data = data || {};
  return _.pick(_.defaults(data, schema || this.config.schema), _.keys(schema || this.config.schema));
};

// Get/Set data on model
Model.prototype.get = function(name) {
  return this.data[name];
};
Model.prototype.set = function(name, value) {
  // update property value
  this.data[name] = value;

  // set dirty flag for this property
  if(this.dirtys.indexOf(name) == -1) {
    this.dirtys.push(name);
  }
};

// Update the existing database entry according to the model data
Model.prototype.update = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Construct key to identify the entry to be updated
    var Key = {};
    Key[self.config.keys.primary] = self.data[self.config.keys.primary];

    // Update the entry with values which have changed in the model
    var Updates = {};
    for(var i = 0; i < self.dirtys.length; i++) {
      var name = self.dirtys[i];
      Updates[name] = {
        Action: 'PUT',
        Value: self.data[name]
      }
    }

    // Perform the update
    aws.dbClient.update({
      TableName: self.config.table,
      Key: Key,
      AttributeUpdates: Updates
    }, function(err, data) {
      if(err) return reject(err);
      self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
      return resolve();
    });
  });
};

// Save a new database entry according to the model data
Model.prototype.save = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.put({
      TableName: self.config.table,
      Item: self.data
    }, function(err, data) {
      if(err) return reject(err);
      self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
      return resolve();
    });
  });
};

// Delete the database entry specified by the model data
// The key should be the Primary key values identifying the object to be deleted
Model.prototype.delete = function(Key) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.delete({
      TableName: self.config.table,
      Key: Key
    }, function(err, data) {
      if(err) return reject(err);
      self.data = self.sanitize({});
      return resolve();
    });
  });
};

module.exports = Model;
