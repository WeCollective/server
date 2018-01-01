const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const Constants = reqlib('config/constants');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class CommentData extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.CommentData,
      schema: db.Schema.CommentData,
      table: db.Table.CommentData,
    });
  }

  // Get a comment's data by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no post found.
  findById(id) {
    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id,
        },
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
    if (!Array.isArray(props) || !props.length) {
      props = [
        'creator',
        'date',
        'edited',
        'id',
        'text',
      ];
    }

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

        case 'edited':
          test = validate.boolean;
          break;

        case 'id':
          test = validate.commentid;
          break;

        case 'text':
          params = [1, Constants.EntityLimits.commentText];
          test = validate.range;
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

module.exports = CommentData;
