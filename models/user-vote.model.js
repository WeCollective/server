const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class Vote extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.UserVotes,
      schema: db.Schema.UserVote,
      table: db.Table.UserVotes,
    });
  }

  findByUsernameAndItemId(username, itemid) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':itemid': itemid,
          ':username': username,
        },
        KeyConditionExpression: 'username = :username AND itemid = :itemid',
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return resolve();
        }

        this.data = data.Items[0];
        return resolve(this.data);
      });
    });
  }

  validate(props) {
    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let test;

      switch (key) {
        case 'direction':
          test = validate.voteDirection;
          break;

        case 'username':
          test = validate.username;
          break;

        default:
          throw new Error(`Invalid validation key "${key}"`);
      }

      if (!test(value)) {
        invalids = [
          ...invalids,
          `Invalid ${key} - ${value}.`,
        ];
      }
    });

    return invalids;
  }
}

module.exports = Vote;
