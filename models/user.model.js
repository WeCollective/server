'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

// Check whether a string is an email using regex and the RFC822 spec
function isEmail(email) {
  return /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/.test( email );
}

const User = function (data) {
  this.config = {
    keys: db.Keys.Users,
    schema: db.Schema.User,
    table: db.Table.Users,
  };
  this.data = this.sanitize(data);
};

// User model inherits from Model
User.prototype = Object.create(Model.prototype);
User.prototype.constructor = User;

User.prototype.findByEmail = function (email) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':email': email,
      },
      IndexName: self.config.keys.globalIndexes[0],
      KeyConditionExpression: 'email = :email',
      ScanIndexForward: false,   // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      
      if (!data || !data.Items || !data.Items.length) {
        return reject();
      }

      self.data = data.Items[0];
      return resolve(self.data);
    });
  });
};

// Get a user by their username from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
User.prototype.findByUsername = function (username) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.get({
      Key: { username },
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

// Validate the properties specified in 'properties' on the user object,
// returning an array of any invalid ones
User.prototype.validate = function (properties) {
  const invalids = [];

  if (properties.includes('datejoined')) {
    if (!validate.date(this.data.datejoined)) {
      invalids.push('datejoined');
    }
  }

  if (properties.includes('dob')) {
    if (!validate.date(this.data.dob)) {
      invalids.push('dob');
    }
  }

  if (properties.includes('email')) {
    // check for a valid email address
    if (!this.data.email || !isEmail(this.data.email)) {
      invalids.push('email');
    }
  }

  if (properties.includes('name')) {
    // check for a valid name length
    if (!this.data.name || this.data.name.length < 2 || this.data.name.length > 30) {
      invalids.push('name');
    }
  }

  if (properties.includes('num_branches')) {
    if (isNaN(this.data.num_branches)) {
      invalids.push('num_branches');
    }
  }

  if (properties.includes('num_comments')) {
    if (isNaN(this.data.num_comments)) {
      invalids.push('num_comments');
    }
  }

  if (properties.includes('num_mod_positions')) {
    if (isNaN(this.data.num_mod_positions)) {
      invalids.push('num_mod_positions');
    }
  }

  if (properties.includes('num_posts')) {
    if (isNaN(this.data.num_posts)) {
      invalids.push('num_posts');
    }
  }

  if (properties.includes('password')) {
    // ensure password length is at least 6 characters and at most 30
    if (!this.data.password || this.data.password.length < 6 || this.data.password.length > 30) {
      invalids.push('password');
    }
    // ensure password contains no whitespace
    if (/\s/g.test(this.data.password)) {
      invalids.push('password');
    }
  }

  if (properties.includes('show_nsfw')) {
    if (!validate.boolean(this.data.show_nsfw)) {
      invalids.push('show_nsfw');
    }
  }

  if (properties.includes('username')) {
    if (!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  if (properties.includes('verified')) {
    if (!validate.boolean(this.data.verified)) {
      invalids.push('verified');
    }
  }

  return invalids;
};

module.exports = User;
