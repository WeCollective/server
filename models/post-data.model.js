const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

class PostData extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.PostData,
      schema: db.Schema.PostData,
      table: db.Table.PostData,
    });
  }

  // Get a post' data by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no post found.
  findById(id) {
    return new Promise( (resolve, reject) => {
      aws.dbClient.get({
        Key: { id },
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
}

module.exports = PostData;
