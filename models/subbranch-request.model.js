const _ = require('lodash');
const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Mod = reqlib('models/mod.model');
const Model = reqlib('models/model');
const Notification = reqlib('models/notification.model');
const NotificationTypes = reqlib('config/notification-types');
const validate = reqlib('models/validate');

class SubBranchRequest extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.SubBranchRequests,
      schema: db.Schema.SubBranchRequest,
      table: db.Table.SubBranchRequests,
    });
  }

  // Get a subbranch request by the parent and childs ids, passing data to resolve
  // Rejects promise with true if database error, with false if no data found.
  find(parentid, childid) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':childid': childid,
          ':parentid': parentid,
        },
        KeyConditionExpression: 'parentid = :parentid and childid = :childid',
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items) {
          return reject();
        }

        return resolve(data.Items);
      });
    });
  }

  // Get the subbranch requests of a specific branch, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no data found.
  findByBranch(branchid) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': branchid,
        },
        IndexName: this.config.keys.globalIndexes[0],
        KeyConditionExpression: 'parentid = :id',
        // return results newest first
        ScanIndexForward: false,
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items) {
          return reject();
        }

        return resolve(data.Items);
      });
    });
  }

  // Override Model.save() in order to create a notification for the branch
  // mods whenever a new SubBranchRequest is created
  save() {
    return new Promise((resolve, reject) => {
      // fetch the mods of the parent (recipient) branch
      let parentMods;
      let childMods;

      new Mod()
        .findByBranch(this.data.parentid)
        .then(mods => {
          parentMods = mods;
          return new Mod().findByBranch(this.data.childid);
        })
        .then(mods => {
          childMods = mods;
          // remove any duplicates e.g. for user who is a mod of both branches
          const allMods = _.uniqBy(parentMods.concat(childMods), 'username');

          // send notification of the new child branch request to these mods
          let promises = [];
          const date = new Date().getTime();
          for (let i = 0; i < allMods.length; i += 1) {
            const notification = new Notification({
              data: {
                childid: this.data.childid,
                parentid: this.data.parentid,
                username: this.data.creator,
              },
              date,
              id: `${allMods[i].username}-${date}`,
              unread: true,
              user: allMods[i].username,
              type: NotificationTypes.NEW_CHILD_BRANCH_REQUEST,
            });

            const invalids = notification.validate();
            if (invalids.length > 0) {
              console.error('Error creating notification.');
              return reject()
            }

            promises = [
              ...promises,
              notification.save(),
            ];
          }

          return Promise.all(promises);
        })
        .then(() => {
          // save the subbranchRequest
          aws.dbClient.put({
            Item: this.data,
            TableName: this.config.table,
          }, (err) => {
            if (err) {
              return reject(err);
            }

            // clear dirtys array
            this.dirtys.splice(0, this.dirtys.length);
            return resolve();
          });
        });
    });
  }

  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'childid',
        'creator',
        'date',
        'parentid',
      ];
    }

    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let test;

      switch (key) {
        case 'childid':
        case 'parentid':
          test = validate.branchid;
          break;

        case 'creator':
          test = validate.username;
          break;

        case 'date':
          test = validate.date;
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

module.exports = SubBranchRequest;
