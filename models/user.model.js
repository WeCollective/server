'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var User = function(data) {
  this.config = {
    schema: db.Schema.User,
    table: db.Table.Users,
    keys: db.Keys.Users
  };
  this.data = this.sanitize(data);
};

// User model inherits from Model
User.prototype = Object.create(Model.prototype);
User.prototype.constructor = User;

// Check whether a string is an email using regex and the RFC822 spec
function isEmail(email) {
  return /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/.test( email );
}

// Validate the properties specified in 'properties' on the user object,
// returning an array of any invalid ones
User.prototype.validate = function(properties) {
  var invalids = [];

  if(properties.indexOf('username') > -1) {
    if(!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  if(properties.indexOf('password') > -1) {
    // ensure password length is at least 6 characters and at most 30
    if(!this.data.password ||
        this.data.password.length < 6 || this.data.password.length > 30) {
      invalids.push('password');
    }
    // ensure password contains no whitespace
    if(/\s/g.test(this.data.password)) {
      invalids.push('password');
    }
  }

  if(properties.indexOf('email') > -1) {
    // check for a valid email address
    if(!this.data.email || !isEmail(this.data.email)) {
      invalids.push('email');
    }
  }

  if(properties.indexOf('firstname') > -1) {
    // check for a valid first name length
    if(!this.data.firstname ||
        this.data.firstname.length < 2 || this.data.firstname.length > 30) {
      invalids.push('firstname');
    }
    // ensure first name contains no whitespace
    if(/\s/g.test(this.data.firstname)) {
      invalids.push('firstname');
    }
  }

  if(properties.indexOf('lastname') > -1) {
    // check for a valid last name length
    if(!this.data.lastname || this.data.lastname.length < 2 || this.data.lastname.length > 30) {
      invalids.push('lastname');
    }
    // ensure last name contains no whitespace
    if(/\s/g.test(this.data.lastname)) {
      invalids.push('lastname');
    }
  }

  if(properties.indexOf('datejoined') > -1) {
    if(!validate.date(this.data.datejoined)) {
      invalids.push('datejoined');
    }
  }

  if(properties.indexOf('dob') > -1) {
    if(!validate.date(this.data.dob)) {
      invalids.push('dob');
    }
  }

  if(properties.indexOf('verified') > -1) {
    if(!validate.boolean(this.data.verified)) {
      invalids.push('verified');
    }
  }

  if(properties.indexOf('num_posts') > -1) {
    if(isNaN(this.data.num_posts)) {
      invalids.push('num_posts');
    }
  }

  if(properties.indexOf('num_comments') > -1) {
    if(isNaN(this.data.num_comments)) {
      invalids.push('num_comments');
    }
  }

  if(properties.indexOf('num_branches') > -1) {
    if(isNaN(this.data.num_branches)) {
      invalids.push('num_branches');
    }
  }

  if(properties.indexOf('num_mod_positions') > -1) {
    if(isNaN(this.data.num_mod_positions)) {
      invalids.push('num_mod_positions');
    }
  }

  if(properties.indexOf('show_nsfw') > -1) {
    if(!validate.boolean(this.data.show_nsfw)) {
      invalids.push('show_nsfw');
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

User.prototype.findByEmail = function(email) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.globalIndexes[0],
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email
      },
      ScanIndexForward: false   // return results highest first
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items || data.Items.length == 0) {
        return reject();
      }
      self.data = data.Items[0];
      resolve();
    });
  });
};

module.exports = User;
