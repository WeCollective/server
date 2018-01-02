const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

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
    super(props, {
      keys: db.Keys.Posts,
      schema: db.Schema.Post,
      table: db.Table.Posts,
    });
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
      const limit = 30;

      let indexName = this.config.keys.globalIndexes[0];
      let params = {};

      if (sortBy === 'points') {
        switch(stat) {
          case 'individual':
            indexName = this.config.keys.globalIndexes[0];
            break;

          case 'local':
            indexName = this.config.keys.globalIndexes[1];
            break;

          case 'global':
          default:
            indexName = this.config.keys.globalIndexes[4];
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
        indexName = this.config.keys.globalIndexes[2];

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
        indexName = this.config.keys.globalIndexes[3];

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
      params.TableName = this.config.table;

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
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': id,
        },
        KeyConditionExpression: 'id = :id',
        TableName: this.config.table,
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
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':branchid': branchid,
          ':postid': postid,
        },
        KeyConditionExpression: 'id = :postid AND branchid = :branchid',
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return reject();
        }

        const posts = formatPostsToNewAPI(data.Items);

        this.data = posts[0];
        return resolve(this.data);
      });
    });
  }
}

module.exports = Post;
