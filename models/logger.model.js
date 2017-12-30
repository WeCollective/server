const reqlib = require('app-root-path').require;

const db = reqlib('config/database');
const Model = reqlib('models/model');

class Logger extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Loggers,
      schema: db.Schema.Logger,
      table: db.Table.Loggers,
    };

    this.data = this.sanitize(props);
  }

  record(eventType, extra) {
    this.set('createdAt', Date.now());
    this.set('event', eventType);
    this.set('extra', extra);
    return this.save();
  }
}

module.exports = Logger;
