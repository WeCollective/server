const reqlib = require('app-root-path').require;

const db = reqlib('config/database');
const Model = reqlib('models/model');

class CommentData extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.CommentData,
      schema: db.Schema.CommentData,
      table: db.Table.CommentData,
    });
  }
}

module.exports = CommentData;
