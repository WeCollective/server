'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

var User = function(data) {
  this.config = {
    schema: db.Schema.User,
    table: db.Table.Users,
    keys: db.Keys.Users
  };
  this.restricted = ['username', 'password', 'datejoined'];
  this.data = this.sanitize(data);
};

// User model inherits from Model
User.prototype = Object.create(Model.prototype);
User.prototype.constructor = User;

// Check whether a string is an email using regex and the RFC822 spec
function isEmail(email) {
  return /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/.test( email );
}
// Validate user object, returning an array of any invalid properties
User.prototype.validate = function() {
  var invalids = [];

  // ensure username length is over 1 char and less than 20
  if(!this.data.username ||
      this.data.username.length < 1 || this.data.username.length > 20) {
    invalids.push('username');
  }

  // ensure username contains no whitespace
  if(/\s/g.test(this.data.username)) {
    invalids.push('username');
  }

  // ensure password length is at least 6 characters and at most 30
  if(!this.data.password ||
      this.data.password.length < 6 || this.data.password.length > 30) {
    invalids.push('password');
  }

  // ensure password contains no whitespace
  if(/\s/g.test(this.data.password)) {
    invalids.push('password');
  }

  // check for a valid email address
  if(!this.data.email || !isEmail(this.data.email)) {
    invalids.push('email');
  }

  // check for a valid first name length
  if(!this.data.firstname ||
      this.data.firstname.length < 2 || this.data.firstname.length > 30) {
    invalids.push('firstname');
  }

  // ensure first name contains no whitespace
  if(/\s/g.test(this.data.firstname)) {
    invalids.push('firstname');
  }

  // check for a valid last name length
  if(!this.data.lastname || this.data.lastname.length < 2 || this.data.lastname.length > 30) {
    invalids.push('lastname');
  }

  // ensure last name contains no whitespace
  if(/\s/g.test(this.data.lastname)) {
    invalids.push('lastname');
  }

  // check for valid date joined
  if(!this.data.datejoined || !Number(this.data.datejoined) > 0) {
    invalids.push('datejoined');
  }

  // check for valid date of birth
  if(this.data.dob) {
    if(!Number(this.data.dob) > 0) {
      invalids.push('dob');
    }
  }

  return invalids;
};

// Get a user by their username from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
User.prototype.findByUsername = function(username) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'username': username
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

module.exports = User;
