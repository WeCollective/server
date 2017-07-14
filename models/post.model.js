'use strict';

const _ = require('lodash');
const aws = require('../config/aws');
const db  = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

let Post = function(data) {
  this.config = {
    keys: db.Keys.Posts,
    schema: db.Schema.Post,
    table: db.Table.Posts
  };
  this.data = this.sanitize(data);
};

// Post model inherits from Model
Post.prototype = Object.create(Model.prototype);
Post.prototype.constructor = Post;

// Fetch the posts on a specific branch, using a specific stat, and filtered by time
Post.prototype.findByBranch = function (branchid, timeafter, nsfw, sortBy, stat, postType, last) {
  return new Promise((resolve, reject) => {
    const self = this;
    const limit = 30;

    let indexName = self.config.keys.globalIndexes[0];
    let params = {};

    if (sortBy === 'points') {
      switch(stat) {
        case 'global':
          indexName = self.config.keys.globalIndexes[4];
          break;

        case 'individual':
          indexName = self.config.keys.globalIndexes[0];
          break;

        case 'local':
          indexName = self.config.keys.globalIndexes[1];
          break;
      }

      if (last) {
        let tmp = {
          branchid: last.branchid,
          id: last.id,
        };
        tmp[stat] = last[stat];
        last = tmp;
      }

      params = {
        FilterExpression: '#date >= :timeafter',
        KeyConditionExpression: 'branchid = :branchid',
      };
    }
    else if (sortBy === 'date') {
      indexName = self.config.keys.globalIndexes[2];

      if (last) {
        last = {
          branchid: last.branchid,
          date: last.date,
          id: last.id,
        };
      }

      params = {
        KeyConditionExpression: 'branchid = :branchid AND #date >= :timeafter',
      };
    }
    else if (sortBy === 'comment_count') {
      indexName = self.config.keys.globalIndexes[3];

      if (last) {
        last = {
          branchid: last.branchid,
          comment_count: last.comment_count,
          id: last.id,
        };
      }

      params = {
        FilterExpression: '#date >= :timeafter',
        KeyConditionExpression: 'branchid = :branchid',
      };
    }

    params.ExclusiveStartKey = last || null;  // fetch results which come _after_ this
    // date is a reserved dynamodb keyword so must use this alias:
    params.ExpressionAttributeNames = { '#date': 'date' };
    params.ExpressionAttributeValues = {
      ':branchid': String(branchid),
      ':timeafter': Number(timeafter),
    };
    params.IndexName = indexName;
    params.ScanIndexForward = false;   // return results highest first
    params.Select = 'ALL_PROJECTED_ATTRIBUTES';
    params.TableName = self.config.table;

    if (postType !== 'all') {
      params.FilterExpression = params.FilterExpression ? (params.FilterExpression + ' AND #type = :postType') : '#type = :postType';
      params.ExpressionAttributeNames['#type'] = 'type';
      params.ExpressionAttributeValues[':postType'] = String(postType);
    }

    if (!nsfw) {
      params.FilterExpression = params.FilterExpression ? (params.FilterExpression + ' AND nsfw = :nsfw') : 'nsfw = :nsfw';
      params.ExpressionAttributeValues[':nsfw'] = false;
    }

    aws.dbClient.query(params, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      const posts = data.Items.slice(0, limit);

      posts.forEach(post => {
        post.votes = {
          down: post.down,
          global: post.global,
          individual: post.individual,
          local: post.local,
          up: post.up,
        };
      });

      return resolve(posts);
    });
  });
};

// Get a post by its id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Post.prototype.findById = function (id) {
  const self = this;

  return new Promise( (resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':id': id
      },
      KeyConditionExpression: 'id = :id',
      TableName: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      return resolve(data.Items);
    });
  });
};

// Get a post by both its post id and branch id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
// Used to ensure a post exists on a given branch.
Post.prototype.findByPostAndBranchIds = function (postid, branchid) {
  const self = this;

  return new Promise( (resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':branchid': branchid,
        ':postid': postid
      },
      KeyConditionExpression: 'id = :postid AND branchid = :branchid',
      TableName: self.config.table
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items || !data.Items.length) {
        return reject();
      }

      self.data = data.Items[0];
      return resolve();
    });
  });
};

// Validate the properties specified in 'properties' on the Post object,
// returning an array of any invalid ones
Post.prototype.validate = function (properties) {
  let invalids = [];

  // ensure id exists and is of correct length
  if (properties.indexOf('id') !== -1) {
    if (!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure branchid exists and is of correct length
  if (properties.indexOf('branchid') !== -1) {
    if (!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  // ensure creation date is valid
  if (properties.indexOf('date') !== -1) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure type is valid
  if (properties.indexOf('type') !== -1) {
    if (this.data.type !== 'text' && this.data.type !== 'page' &&
       this.data.type !== 'image' && this.data.type !== 'audio' &&
       this.data.type !== 'video' && this.data.type !== 'poll') {
      invalids.push('type');
    }
  }

  // ensure stats are valid numbers
  if (properties.indexOf('individual') !== -1) {
    if (isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }
  
  if (properties.indexOf('local') !== -1) {
    if (isNaN(this.data.local)) {
      invalids.push('local');
    }
  }

  if (properties.indexOf('global') !== -1) {
    if (isNaN(this.data.global)) {
      invalids.push('global');
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

  if (properties.indexOf('comment_count') !== -1) {
    if (isNaN(this.data.comment_count)) {
      invalids.push('comment_count');
    }
  }

  if (properties.indexOf('nsfw') !== -1) {
    if (!validate.boolean(this.data.nsfw)) {
      invalids.push('nsfw');
    }
  }

  if (properties.indexOf('locked') !== -1) {
    if (!validate.boolean(this.data.locked)) {
      invalids.push('locked');
    }
  }

  return invalids;
};

module.exports = Post;
