const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class UserImage extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.UserImages,
      schema: db.Schema.UserImages,
      table: db.Table.UserImages,
    });
  }

  // Get a user image of given type ('picture', 'cover') by their username from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no image entry found.
  findByUsername(username, type) {
    if (!['cover', 'picture'].includes(type)) {
      return Promise.reject();
    }

    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id: `${username}-${type}`,
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
        return resolve();
      });
    });
  }

  // Validate user picture object, returning an array of any invalid properties
  validate() {
    let invalids = [];

    // check for valid id ending with -picture or -cover
    if (!this.data.id || (!this.data.id.endsWith('-picture') && !this.data.id.endsWith('-cover'))) {
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

module.exports = UserImage;
