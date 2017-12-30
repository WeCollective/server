const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class UserImage extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.UserImages,
      schema: db.Schema.UserImages,
      table: db.Table.UserImages,
    };

    this.data = this.sanitize(props);
    this.restricted = ['id'];
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
