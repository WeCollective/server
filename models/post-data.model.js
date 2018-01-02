const reqlib = require('app-root-path').require;

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
}

module.exports = PostData;
