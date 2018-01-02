const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

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
}

module.exports = PostImage;
