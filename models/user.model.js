const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const Constants = reqlib('config/constants');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class User extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Users,
      schema: db.Schema.User,
      table: db.Table.Users,
    });
  }

  findByEmail(email) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':email': email,
        },
        IndexName: this.config.keys.globalIndexes[0],
        KeyConditionExpression: 'email = :email',
        ScanIndexForward: false, // return results highest first
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return reject();
        }

        this.data = data.Items[0];
        return resolve(this.data);
      });
    });
  }

  // Get a user by their username from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findByUsername(username) {
    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: { username },
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

  validate(props) {
    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let params = [];
      let test;

      switch (key) {
        case 'datejoined':
          test = validate.date;
          break;

        case 'dob':
          test = validate.age;
          break;

        case 'email':
          test = validate.email;
          break;

        case 'name':
          params = [
            Constants.EntityLimits.userFullNameMin,
            Constants.EntityLimits.userFullNameMax,
          ];
          test = validate.range;
          break;

        case 'num_branches':
        case 'num_comments':
        case 'num_mod_positions':
        case 'num_posts':
          test = validate.number;
          break;

        case 'password':
          test = validate.password;
          break;

        case 'show_nsfw':
        case 'verified':
          test = validate.boolean;
          break;

        case 'username':
          test = validate.username;
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

module.exports = User;
