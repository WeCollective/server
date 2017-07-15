'use strict';

const _ = require('lodash');
const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const Comment = function (data) {
  this.config = {
    keys: db.Keys.Comments,
    schema: db.Schema.Comment,
    table: db.Table.Comments,
  };
  this.data = this.sanitize(data);
};

function formatCommentsToNewAPI (comments) {
  comments = comments || [];

  comments.forEach(comment => {
    comment.votes = {
      down: comment.down,
      individual: comment.individual,
      up: comment.up,
    };
  });

  return comments;
}

// Comment model inherits from Model
Comment.prototype = Object.create(Model.prototype);
Comment.prototype.constructor = Comment;

// Validate the properties specified in 'properties' on the Comment object,
// returning an array of any invalid ones
Comment.prototype.validate = function (properties) {
  const invalids = [];

  // ensure id exists and is of correct length
  if (properties.includes('id')) {
    if (!validate.commentid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure postid exists and is of correct length
  if (properties.includes('postid')) {
    if (!validate.postid(this.data.postid)) {
      invalids.push('postid');
    }
  }

  // ensure parentid exists and is of correct length
  if (properties.includes('parentid')) {
    if (!validate.commentid(this.data.parentid)) {
      invalids.push('parentid');
    }
  }

  // ensure stats are valid numbers
  if (properties.includes('individual')) {
    if (isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }

  if (properties.includes('up')) {
    if (isNaN(this.data.up)) {
      invalids.push('up');
    }
  }

  if (properties.includes('down')) {
    if (isNaN(this.data.down)) {
      invalids.push('down');
    }
  }

  if (properties.includes('rank')) {
    if (isNaN(this.data.rank)) {
      invalids.push('rank');
    }
  }

  if (properties.includes('replies')) {
    if (isNaN(this.data.replies)) {
      invalids.push('replies');
    }
  }

  // ensure creation date is valid
  if (properties.includes('date')) {
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

      const comments = formatCommentsToNewAPI([data.Item]);
      self.data = comments[0];
      return resolve(self.data);
    });
  });
};

Comment.prototype.findByParent = function (postid, parentid, sortBy, last) {
  const self = this;

  const limit = 20;
  let IndexName;

  switch(sortBy) {
    case 'date':
      IndexName = self.config.keys.globalIndexes[1];
      break;

    case 'replies':
      IndexName = self.config.keys.globalIndexes[2];
      break;

    case 'points':
    default:
      IndexName = self.config.keys.globalIndexes[0];
      break;
  }

  if (last) {
    let tmp = {
      id: last.id,
      postid: last.postid,
    };

    if (sortBy === 'points') {
      tmp.individual = last.individual;
    }
    else {
      tmp[sortBy] = last[sortBy];
    }

    last = tmp;
  }

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExclusiveStartKey: last || null,  // fetch results which come _after_ this
      ExpressionAttributeValues: {
        ':parentid': parentid,
        ':postid': postid,
      },
      FilterExpression: 'parentid = :parentid',
      IndexName,
      KeyConditionExpression: 'postid = :postid',
      ScanIndexForward: false,   // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      const comments = formatCommentsToNewAPI(data.Items.slice(0, limit));
      return resolve(comments);
    });
  });
};

module.exports = Comment;
