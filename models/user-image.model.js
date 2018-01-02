const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

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

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id: `${username}-${type}`,
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
        return resolve();
      });
    });
  }
}

module.exports = UserImage;
