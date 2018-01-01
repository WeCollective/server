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

  // Validate the properties specified in 'properties' on the Vote object,
  // returning an array of any invalid ones
  validate(props) {
    let invalids = [];

    if (props.includes('direction')) {
      if (this.data.direction !== 'up' && this.data.direction !== 'down') {
        invalids = [
          ...invalids,
          'direction',
        ];
      }
    }

    if (props.includes('username')) {
      if (!validate.username(this.data.username)) {
        invalids = [
          ...invalids,
          'username',
        ];
      }
    }

    return invalids;
  }
}

module.exports = Vote;
