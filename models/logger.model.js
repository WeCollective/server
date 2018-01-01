const reqlib = require('app-root-path').require;

const db = reqlib('config/database');
const Model = reqlib('models/model');

class Logger extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Loggers,
      schema: db.Schema.Logger,
      table: db.Table.Loggers,
    });
  }

  record(eventType, extra) {
    this.set('createdAt', Date.now());
    this.set('event', eventType);
    this.set('extra', extra);
    return this.save();
  }
}

module.exports = Logger;
