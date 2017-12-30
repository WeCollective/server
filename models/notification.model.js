const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class Notification extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Notifications,
      schema: db.Schema.Notification,
      table: db.Table.Notifications,
    };

    this.data = this.sanitize(props);
  }

  // Get a Notification by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findById(id) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: { id },
        TableName: self.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Item) {
          return reject();
        }

        self.data = data.Item;
        return resolve(self.data);
      });
    });
  }

  findByUsername(username, unreadCount, last, getAllUnread) {
    const self = this;
    const limit = getAllUnread !== undefined ? 0 : 20;
    
    if (last) {
      const tmp = {
        id: last.id,
        date: last.date,
        user: last.user,
      };

      last = tmp;
    }

    return new Promise((resolve, reject) => {
      const options = {
        // fetch results which come _after_ this
        ExclusiveStartKey: last || null,
        // date is a reserved dynamodb keyword so must use this alias:
        ExpressionAttributeNames: {
          '#user': 'user',
        },
        ExpressionAttributeValues: {
          ':username': String(username),
        },
        IndexName: self.config.keys.globalIndexes[0],
        KeyConditionExpression: '#user = :username',
        // return results highest first
        ScanIndexForward: false,
        Select: unreadCount ? 'COUNT' : 'ALL_PROJECTED_ATTRIBUTES',
        TableName: self.config.table,
      };

      if (unreadCount || getAllUnread === true) {
        options.FilterExpression = 'unread = :unread';
        options.ExpressionAttributeValues[':unread'] = true;
      }

      aws.dbClient.query(options, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (unreadCount) {
          if (!data || !data.Count) {
            return resolve(0);
          }
        }
        else {
          if (!data || !data.Items) {
            return reject();
          }
        }

        let result;
        if (data.Items) {
          result = limit ? data.Items.slice(0, limit) : data.Items;
        }
        else {
          result = data.Count;
        }

        return resolve(result);
      });
    });
  }

  // Override Model.save() in order to emit notification event to client
  // Save a new database entry according to the model data
  save() {
    const self = this;

    return new Promise((resolve, reject) => {
      // Fetch the session for the user given by the sessionId.
      // todo Legacy now since we don't use sessions anymore. Not sure how the original
      // implementation was meant to work.
      /*
      if (sessionId) {
        aws.dbClient.get({
          Key: {
            id: `sess:${sessionId}`,
          },
          TableName: db.Table.Sessions,
        }, (err, data) => {
          if (err) {
            return reject(err);
          }

          if (!data || !data.Item) {
            return reject();
          }

          // TODO return # of notifications
          io.notifications.to(data.Item.socketID).emit('notification', null);
        });
      }
      */

      aws.dbClient.put({
        Item: self.data,
        TableName: self.config.table,
      }, (err) => {
        if (err) {
          return reject(err);
        }

        // Clear dirtys array.
        self.dirtys.splice(0, self.dirtys.length);
        return resolve();
      });
    });
  }

  // Validate the properties specified in 'properties' on the Notification object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'data',
        'date',
        'id',
        'type',
        'unread',
        'user',
      ];
    }

    let invalids = [];

    // TODO check data is a valid JSON for the given type
    if (props.includes('data')) {
      // 
    }

    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'date',
        ];
      }
    }

    if (props.includes('id')) {
      if (!validate.notificationid(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
        ];
      }
    }

    if (props.includes('type')) {
      if (!validate.notificationType(this.data.type)) {
        invalids = [
          ...invalids,
          'type',
        ];
      }
    }

    if (props.includes('unread')) {
      if (!validate.boolean(this.data.unread)) {
        invalids = [
          ...invalids,
          'unread',
        ];
      }
    }

    if (props.includes('user')) {
      if (!validate.username(this.data.user)) {
        invalids = [
          ...invalids,
          'user',
        ];
      }
    }

    return invalids;
  }
}

module.exports = Notification;
