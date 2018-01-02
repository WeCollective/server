const reqlib = require('app-root-path').require;

const db = reqlib('config/database');
const Model = reqlib('models/model');

class Constant extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Constants,
      schema: db.Schema.Constant,
      table: db.Table.Constants,
    });
  }
}

module.exports = Constant;
