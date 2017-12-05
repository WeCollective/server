const aws = require('../config/aws');
const db  = require('../config/database');
const Model = require('./model');
const PostData = require('./post-data.model');
const validate = require('./validate');

const formatPostsToNewAPI = posts => {
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
};

class Post extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Posts,
      schema: db.Schema.Post,
      table: db.Table.Posts,
    };

    this.data = this.sanitize(props);
  }

  // Fetch the posts on a specific branch, using a specific stat, and filtered by time
  findByBranch(branchid, timeafter, nsfw, sortBy, stat, postType, last) {
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
  }

  // Get a post by its id, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no data found.
  findById(id) {
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
  }

  // Get a post by both its post id and branch id, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no data found.
  // Used to ensure a post exists on a given branch.
  findByPostAndBranchIds(postid, branchid) {
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
        return resolve(self.data);
      });
    });
  }

  isAuthor(username, postid) {
    return new Promise((resolve, reject) => new PostData()
      .findById(postid)
      .then(postData => resolve(postData.creator === username))
      .catch(err => reject(err)));
  }

  // Validate the properties specified in 'properties' on the Post object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
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

    let invalids = [];

    // ensure id exists and is of correct length
    if (props.includes('id')) {
      if (!validate.postid(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
        ];
      }
    }

    // ensure branchid exists and is of correct length
    if (props.includes('branchid')) {
      if (!validate.branchid(this.data.branchid)) {
        invalids = [
          ...invalids,
          'branchid',
        ];
      }
    }

    // ensure creation date is valid
    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'date',
        ];
      }
    }

    // ensure type is valid
    if (props.includes('type')) {
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
        invalids = [
          ...invalids,
          'type',
        ];
      }
    }

    // ensure stats are valid numbers
    if (props.includes('individual')) {
      if (Number.isNaN(this.data.individual)) {
        invalids = [
          ...invalids,
          'individual',
        ];
      }
    }
    
    if (props.includes('local')) {
      if (Number.isNaN(this.data.local)) {
        invalids = [
          ...invalids,
          'local',
        ];
      }
    }

    if (props.includes('global')) {
      if (Number.isNaN(this.data.global)) {
        invalids = [
          ...invalids,
          'global',
        ];
      }
    }
    
    if (props.includes('up')) {
      if (Number.isNaN(this.data.up)) {
        invalids = [
          ...invalids,
          'up',
        ];
      }
    }
    
    if (props.includes('down')) {
      if (Number.isNaN(this.data.down)) {
        invalids = [
          ...invalids,
          'down',
        ];
      }
    }

    if (props.includes('comment_count')) {
      if (Number.isNaN(this.data.comment_count)) {
        invalids = [
          ...invalids,
          'comment_count',
        ];
      }
    }

    if (props.includes('nsfw')) {
      if (!validate.boolean(this.data.nsfw)) {
        invalids = [
          ...invalids,
          'nsfw',
        ];
      }
    }

    if (props.includes('locked')) {
      if (!validate.boolean(this.data.locked)) {
        invalids = [
          ...invalids,
          'locked',
        ];
      }
    }

    return invalids;
  }
}

module.exports = Post;
