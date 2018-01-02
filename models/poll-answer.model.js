const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

class PollAnswer extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.PollAnswers,
      schema: db.Schema.PollAnswer,
      table: db.Table.PollAnswers,
    });
  }

  // Get a PollAnswer by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no post found.
  findById(id) {
    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: { id },
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Item) {
          return reject();
        }

        this.data = data.Item;
        return resolve(this.data);
      });
    });
  }

  // Fetch the answers on a specific poll sorted by either date or number of votes
  findByPost(postid, sortBy, last) {
    const limit = 30;
    let IndexName = this.config.keys.globalIndexes[1];

    if (sortBy == 'date') {
      IndexName = this.config.keys.globalIndexes[1];
    }
    else if (sortBy == 'votes') {
      IndexName = this.config.keys.globalIndexes[2];
    }

    if (last) {
      last = {
        id: last.id,
        postid: last.postid,
      };
    }

    return new Promise((resolve, reject) => {
      const params = {
        ExclusiveStartKey: last || null, // fetch results which come _after_ this
        ExpressionAttributeValues: { ':postid': String(postid) },
        IndexName,
        KeyConditionExpression: 'postid = :postid',
        ScanIndexForward: false, // return results highest first
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        TableName: this.config.table,
      };
      aws.dbClient.query(params, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items) {
          return reject();
        }

        return resolve(data.Items.slice(0, limit));
      });
    });
  }
}

module.exports = PollAnswer;
