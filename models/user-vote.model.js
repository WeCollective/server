const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

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
}

module.exports = Vote;
