const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const formatCommentsToNewAPI = comments => {
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

class Comment extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Comments,
      schema: db.Schema.Comment,
      table: db.Table.Comments,
    };

    this.data = this.sanitize(props);
  }

  // Get a comment by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findById(id) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id,
        },
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
  }

  findByParent(postid, parentid, sortBy, last) {
    const limit = 20;
    const self = this;
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
      const tmp = {
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
        ExclusiveStartKey: last || null, // fetch results which come _after_ this
        ExpressionAttributeValues: {
          ':parentid': parentid,
          ':postid': postid,
        },
        FilterExpression: 'parentid = :parentid',
        IndexName,
        KeyConditionExpression: 'postid = :postid',
        ScanIndexForward: false, // return results highest first
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
        return resolve({
          comments,
          hasMoreComments: data.Items.length !== comments.length,
        });
      });
    });
  }

  // Validate the properties specified in 'properties' on the Comment object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'date',
        'down',
        'id',
        'individual',
        'parentid',
        'postid',
        'rank',
        'replies',
        'up',
      ];
    }

    let invalids = [];

    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'date',
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

    if (props.includes('id')) {
      if (!validate.commentid(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
        ];
      }
    }

    if (props.includes('individual')) {
      if (Number.isNaN(this.data.individual)) {
        invalids = [
          ...invalids,
          'individual',
        ];
      }
    }

    if (props.includes('parentid')) {
      if (!validate.commentid(this.data.parentid)) {
        invalids = [
          ...invalids,
          'parentid',
        ];
      }
    }

    if (props.includes('postid')) {
      if (!validate.postid(this.data.postid)) {
        invalids = [
          ...invalids,
          'postid',
        ];
      }
    }

    if (props.includes('rank')) {
      if (Number.isNaN(this.data.rank)) {
        invalids = [
          ...invalids,
          'rank',
        ];
      }
    }

    if (props.includes('replies')) {
      if (Number.isNaN(this.data.replies)) {
        invalids = [
          ...invalids,
          'replies',
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

    return invalids;
  }
}

module.exports = Comment;
