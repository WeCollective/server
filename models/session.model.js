'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var Session = function(data) {
  this.config = {
    schema: db.Schema.Session,
    table: db.Table.Sessions,
    keys: db.Keys.Sessions
  };
  this.data = this.sanitize(data);
};

// Session model inherits from Model
Session.prototype = Object.create(Model.prototype);
Session.prototype.constructor = Session;

// Validate the properties specified in 'properties' on the Session object,
// returning an array of any invalid ones
Session.prototype.validate = function(properties) {
  var invalids = [];

  // TODO: validate socketID

  return invalids;
};

// Get a Session by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Session.prototype.findById = function(id) {
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

module.exports = Session;
