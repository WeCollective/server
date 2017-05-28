'use strict';

const _ = require('lodash');
const aws   = require('../config/aws');
const db    = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

var Comment = function (data) {
  this.config = {
    keys: db.Keys.Comments,
    schema: db.Schema.Comment,
    table: db.Table.Comments
  };
  this.data = this.sanitize(data);
};

// Comment model inherits from Model
Comment.prototype = Object.create(Model.prototype);
Comment.prototype.constructor = Comment;

// Validate the properties specified in 'properties' on the Comment object,
// returning an array of any invalid ones
Comment.prototype.validate = function (properties) {
  let invalids = [];

  // ensure id exists and is of correct length
  if (properties.indexOf('id') !== -1) {
    if (!validate.commentid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure postid exists and is of correct length
  if (properties.indexOf('postid') !== -1) {
    if (!validate.postid(this.data.postid)) {
      invalids.push('postid');
    }
  }

  // ensure parentid exists and is of correct length
  if (properties.indexOf('parentid') !== -1) {
    if (!validate.commentid(this.data.parentid)) {
      invalids.push('parentid');
    }
  }

  // ensure stats are valid numbers
  if (properties.indexOf('individual') !== -1) {
    if (isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }

  if (properties.indexOf('up') !== -1) {
    if (isNaN(this.data.up)) {
      invalids.push('up');
    }
  }

  if (properties.indexOf('down') !== -1) {
    if (isNaN(this.data.down)) {
      invalids.push('down');
    }
  }

  if (properties.indexOf('rank') !== -1) {
    if (isNaN(this.data.rank)) {
      invalids.push('rank');
    }
  }

  if (properties.indexOf('replies') !== -1) {
    if (isNaN(this.data.replies)) {
      invalids.push('replies');
    }
  }

  // ensure creation date is valid
  if (properties.indexOf('date') !== -1) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  return invalids;
};

// Get a comment by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Comment.prototype.findById = function (id) {
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

Comment.prototype.findByParent = function (postid, parentid, sortBy, last) {
  const self = this;

  const limit = 20;
  let index;

  switch(sortBy) {
    case 'date':
      index = self.config.keys.globalIndexes[1];
      break;

    case 'replies':
      index = self.config.keys.globalIndexes[2];
      break;

    case 'points':
    default:
      index = self.config.keys.globalIndexes[0];
      break;
  }

  if (last) {
    let tmp = {
      id: last.id,
      postid: last.postid
    };

    if ('points' === sortBy) {
      tmp.individual = last.individual;
    }
    else {
      tmp[sortBy] = last[sortBy];
    }

    last = tmp;
  }

  return new Promise( (resolve, reject) => {
    aws.dbClient.query({
      ExclusiveStartKey: last || null,  // fetch results which come _after_ this
      ExpressionAttributeValues: {
        ':parentid': parentid,
        ':postid': postid
      },
      FilterExpression: 'parentid = :parentid',
      IndexName: index,
      KeyConditionExpression: 'postid = :postid',
      ScanIndexForward: false,   // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      TableName: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      return resolve(data.Items.slice(0, limit));
    });
  });
};

module.exports = Comment;