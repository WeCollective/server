const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const Constants = reqlib('config/constants');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

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

  validate(props) {
    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let params = [];
      let test;

      switch (key) {
        case 'creator':
          test = validate.username;
          break;

        case 'date':
          test = validate.date;
          break;

        case 'id':
          test = validate.pollanswerid;
          break;

        case 'postid':
          test = validate.postid;
          break;

        case 'text':
          params = [1, Constants.EntityLimits.pollAnswerText];
          test = validate.range;
          break;

        case 'votes':
          test = validate.number;
          break;

        default:
          throw new Error(`Invalid validation key "${key}"`);
      }

      if (!test(value, ...params)) {
        invalids = [
          ...invalids,
          `Invalid ${key} - ${value}.`,
        ];
      }
    });

    return invalids;
  }
}

module.exports = PollAnswer;
