const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class Notification extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Notifications,
      schema: db.Schema.Notification,
      table: db.Table.Notifications,
    });
  }

  // Get a Notification by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findById(id) {
    return new Promise((resolve, reject) => {
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

  findByUsername(username, unreadCount, last, getAllUnread) {
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
        IndexName: this.config.keys.globalIndexes[0],
        KeyConditionExpression: '#user = :username',
        // return results highest first
        ScanIndexForward: false,
        Select: unreadCount ? 'COUNT' : 'ALL_PROJECTED_ATTRIBUTES',
        TableName: this.config.table,
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
        Item: this.data,
        TableName: this.config.table,
      }, (err) => {
        if (err) {
          return reject(err);
        }

        // Clear dirtys array.
        this.dirtys.splice(0, this.dirtys.length);
        return resolve();
      });
    });
  }

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

    props.forEach(key => {
      const value = this.data[key];
      let test;

      switch (key) {
        // TODO check data is a valid JSON for the given type
        case 'data':
          test = () => true;
          break;

        case 'date':
          test = validate.date;
          break;

        case 'id':
          test = validate.notificationid;
          break;

        case 'type':
          test = validate.notificationType;
          break;

        case 'unread':
          test = validate.boolean;
          break;

        case 'user':
          test = validate.username;
          break;

        default:
          throw new Error(`Invalid validation key "${key}"`);
      }

      if (!test(value)) {
        invalids = [
          ...invalids,
          `Invalid ${key} - ${value}.`,
        ];
      }
    });

    return invalids;
  }
}

module.exports = Notification;
