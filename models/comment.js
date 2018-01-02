const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

class Comment extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Comments,
      schema: db.Schema.Comment,
      table: db.Table.Comments,
    });
  }

  findByParent(postid, parentid, sortBy, last) {
    const limit = 20;
    let IndexName;

    switch(sortBy) {
      case 'date':
        IndexName = this.config.keys.globalIndexes[1];
        break;

      case 'replies':
        IndexName = this.config.keys.globalIndexes[2];
        break;

      case 'points':
      default:
        IndexName = this.config.keys.globalIndexes[0];
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
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items) {
          return reject();
        }

        const comments = data.Items.slice(0, limit);
        return resolve({
          comments,
          hasMoreComments: data.Items.length !== comments.length,
        });
      });
    });
  }
}

module.exports = Comment;
