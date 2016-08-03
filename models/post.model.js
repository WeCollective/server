'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

var Post = function(data) {
  this.config = {
    schema: db.Schema.Post,
    table: db.Table.Posts,
    keys: db.Keys.Posts
  };
  this.data = this.sanitize(data);
};

// Post model inherits from Model
Post.prototype = Object.create(Model.prototype);
Post.prototype.constructor = Post;

// Validate the properties specified in 'properties' on the Post object,
// returning an array of any invalid ones
Post.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!this.data.id || this.data.id.length < 1 || this.data.id.length > 45) {
      invalids.push('id');
    }
    // ensure id contains no whitespace
    if(/\s/g.test(this.data.id)) {
      invalids.push('id');
    }
    // ensure id is lowercase
    if((typeof this.data.id === 'string' || this.data.id instanceof String) &&
        this.data.id != this.data.id.toLowerCase()) {
      invalids.push('id');
    }
  }

  // ensure branchid exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!this.data.branchid || this.data.branchid.length < 1 || this.data.branchid.length > 30) {
      invalids.push('branchid');
    }
    // ensure branchid contains no whitespace
    if(/\s/g.test(this.data.branchid)) {
      invalids.push('branchid');
    }
    // ensure branchid is lowercase
    if((typeof this.data.branchid === 'string' || this.data.branchid instanceof String) &&
        this.data.branchid != this.data.branchid.toLowerCase()) {
      invalids.push('branchid');
    }
  }

  // ensure type is valid
  if(properties.indexOf('type') > -1) {
    if(this.data.type != 'text') {
      invalids.push('type');
    }
  }

  // ensure stats are valid numbers
  if(properties.indexOf('individual') > -1) {
    if(isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }
  if(properties.indexOf('local') > -1) {
    if(isNaN(this.data.local)) {
      invalids.push('local');
    }
  }
  if(properties.indexOf('up') > -1) {
    if(isNaN(this.data.up)) {
      invalids.push('up');
    }
  }
  if(properties.indexOf('down') > -1) {
    if(isNaN(this.data.down)) {
      invalids.push('down');
    }
  }

  return invalids;
};

module.exports = Post;
