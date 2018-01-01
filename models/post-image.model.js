const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class PostImage extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.PostImages,
      schema: db.Schema.PostImages,
      table: db.Table.PostImages,
    });
  }

  // Get a branch image of given type ('picture', 'cover') by it's id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no image entry found.
  findById(id) {
    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          'id': `${id}-picture`,
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
        return resolve(data.Item);
      });
    });
  }

  validate() {
    const props = [
      'date',
      'extension',
      'id',
    ];

    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let test;

      switch (key) {
        case 'date':
          test = validate.date;
          break;

        case 'extension':
          test = validate.extension;
          break;

        case 'id':
          test = validate.postImageId;
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

module.exports = PostImage;
