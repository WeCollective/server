module.exports = (Dynamite, validate) => {
  const Notification = Dynamite.define('Notification', {
    // TODO check data is a valid JSON for the given type
    data: {
      defaultValue: null,
      validate: null,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.notificationid,
    },
    type: {
      defaultValue: null,
      validate: validate.notificationType,
    },
    unread: {
      defaultValue: null,
      validate: validate.boolean,
    },
    user: {
      defaultValue: null,
      validate: validate.username,
    },
  }, {
    TableIndexes: [
      'user-date-index',
    ],
  });

  Notification.findByUsername = (username, unreadCount, lastInstance, getAllUnread) => {
    const { TableIndexes } = Notification.config.keys;
    const limit = getAllUnread !== undefined ? 0 : 20;

    if (lastInstance) {
      const tmp = {
        id: lastInstance.get('id'),
        date: lastInstance.get('date'),
        user: lastInstance.get('user'),
      };

      lastInstance = tmp;
    }

    const options = {
      // fetch results which come _after_ this
      ExclusiveStartKey: lastInstance || null,
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        '#user': 'user',
      },
      ExpressionAttributeValues: {
        ':username': String(username),
      },
      IndexName: TableIndexes[0],
      KeyConditionExpression: '#user = :username',
      // return results highest first
      ScanIndexForward: false,
      Select: unreadCount ? 'COUNT' : 'ALL_PROJECTED_ATTRIBUTES',
    };

    if (unreadCount || getAllUnread === true) {
      options.FilterExpression = 'unread = :unread';
      options.ExpressionAttributeValues[':unread'] = true;
    }

    // todo has unreadCount...
    // this should be really extracted to a separate method...
    return Dynamite.query(options, Notification)
      .then(data => {
        if (!data) {
          return Promise.reject(data);
        }

        if (unreadCount) {
          return Promise.resolve(!data || !data.Count ? 0 : data.Count);
        }

        let arr = data.Items;

        if (!arr || !Array.isArray(arr)) {
          arr = [];
        }

        const slice = limit ? arr.slice(0, limit) : arr;
        let instances = [];

        slice.forEach(data => {
          const instance = Notification.createInstance(data);
          instances = [
            ...instances,
            instance,
          ];
        });

        return Promise.resolve(instances);
      })
      .catch(err => {
        console.log('DynamoDB error occurred.');
        console.log(err);
        console.log('Passed configuration object.');
        console.log(options);
        return Promise.reject(err);
      });
  };

  return Notification;
};
