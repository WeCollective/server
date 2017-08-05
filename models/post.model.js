'use strict';

const _ = require('lodash');
const aws = require('../config/aws');
const db  = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const Post = function(data) {
  this.config = {
    keys: db.Keys.Posts,
    schema: db.Schema.Post,
    table: db.Table.Posts,
  };
  this.data = this.sanitize(data);
};

function formatPostsToNewAPI (posts) {
  posts = posts || [];

  posts.forEach(post => {
    post.votes = {
      down: post.down,
      global: post.global,
      individual: post.individual,
      local: post.local,
      up: post.up,
    };
  });

  return posts;
}

// Post model inherits from Model
Post.prototype = Object.create(Model.prototype);
Post.prototype.constructor = Post;

// Fetch the posts on a specific branch, using a specific stat, and filtered by time
Post.prototype.findByBranch = function (branchid, timeafter, nsfw, sortBy, stat, postType, last) {
  if (timeafter === undefined) {
    timeafter = 0;
  }

  if (nsfw === undefined) {
    nsfw = true;
  }

  if (sortBy === undefined) {
    sortBy = 'date';
  }

  if (stat === undefined) {
    stat = 'global';
  }

  if (postType === undefined) {
    postType = 'all';
  }

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

      const posts = formatPostsToNewAPI(data.Items.slice(0, limit));
      return resolve(posts);
    });
  });
};

// Get a post by its id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Post.prototype.findById = function (id) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':id': id,
      },
      KeyConditionExpression: 'id = :id',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      const posts = formatPostsToNewAPI(data.Items);
      return resolve(posts);
    });
  });
};

// Get a post by both its post id and branch id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
// Used to ensure a post exists on a given branch.
Post.prototype.findByPostAndBranchIds = function (postid, branchid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':branchid': branchid,
        ':postid': postid,
      },
      KeyConditionExpression: 'id = :postid AND branchid = :branchid',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items || !data.Items.length) {
        return reject();
      }

      const posts = formatPostsToNewAPI(data.Items);

      self.data = posts[0];
      return resolve();
    });
  });
};

// Validate the properties specified in 'properties' on the Post object,
// returning an array of any invalid ones
Post.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'id',
      'branchid',
      'date',
      'type',
      'individual',
      'local',
      'global',
      'up',
      'down',
      'comment_count',
      'nsfw',
      'locked',
    ];
  }

  const invalids = [];

  // ensure id exists and is of correct length
  if (properties.includes('id')) {
    if (!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure branchid exists and is of correct length
  if (properties.includes('branchid')) {
    if (!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
  }

  // ensure creation date is valid
  if (properties.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure type is valid
  if (properties.includes('type')) {
    /*
     * todo This should be thrown into a separate module
     * as it is used elsewhere throughout the API.
     */
    const validPostTypes = [
      'text',
      'page',
      'image',
      'audio',
      'video',
      'poll',
    ];

    if (!validPostTypes.includes(this.data.type)) {
      invalids.push('type');
    }
  }

  // ensure stats are valid numbers
  if (properties.includes('individual')) {
    if (isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }
  
  if (properties.includes('local')) {
    if (isNaN(this.data.local)) {
      invalids.push('local');
    }
  }

  if (properties.includes('global')) {
    if (isNaN(this.data.global)) {
      invalids.push('global');
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

  if (properties.includes('comment_count')) {
    if (isNaN(this.data.comment_count)) {
      invalids.push('comment_count');
    }
  }

  if (properties.includes('nsfw')) {
    if (!validate.boolean(this.data.nsfw)) {
      invalids.push('nsfw');
    }
  }

  if (properties.includes('locked')) {
    if (!validate.boolean(this.data.locked)) {
      invalids.push('locked');
    }
  }

  return invalids;
};

module.exports = Post;
