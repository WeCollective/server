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
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          'id': `${id}-picture`,
        },
        TableName: self.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Item) {
          return reject();
        }

        self.data = data.Item;
        return resolve(data.Item);
      });
    });
  }

  // Validate user picture object, returning an array of any invalid properties
  validate() {
    let invalids = [];

    // check for valid id ending with -picture or -cover
    if (!this.data.id || !this.data.id.endsWith('-picture')) {
      invalids = [
        ...invalids,
        'id',
      ];
    }

    // check for valid date
    if (!validate.date(this.data.date)) {
      invalids = [
        ...invalids,
        'date',
      ];
    }

    // check for valid extension
    if (!validate.extension(this.data.extension)) {
      invalids = [
        ...invalids,
        'extension',
      ];
    }

    return invalids;
  }
}

module.exports = PostImage;
