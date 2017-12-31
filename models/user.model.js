const moment = require('moment');
const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const Constants = reqlib('config/constants');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

// Check whether a string is an email using regex and the RFC822 spec
const isEmail = email => /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/.test(email);

class User extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Users,
      schema: db.Schema.User,
      table: db.Table.Users,
    };

    this.data = this.sanitize(props);
  }

  findByEmail(email) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':email': email,
        },
        IndexName: self.config.keys.globalIndexes[0],
        KeyConditionExpression: 'email = :email',
        ScanIndexForward: false, // return results highest first
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        TableName: self.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return reject();
        }

        self.data = data.Items[0];
        return resolve(self.data);
      });
    });
  }

  // Get a user by their username from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findByUsername(username) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: { username },
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

  // Validate the properties specified in 'props' on the user object,
  // returning an array of any invalid ones
  validate(props) {
    let invalids = [];

    if (props.includes('datejoined')) {
      if (!validate.date(this.data.datejoined)) {
        invalids = [
          ...invalids,
          'Invalid datejoined',
        ];
      }
    }

    if (props.includes('dob')) {
      const { dob } = this.data;
      const { userAgeMin } = Constants.EntityLimits;

      if (!validate.date(dob)) {
        invalids = [
          ...invalids,
          'Invalid dob',
        ];
      }
      else if (moment().diff(moment(dob), 'years') < userAgeMin) {
        invalids = [
          ...invalids,
          `You need to be at least ${userAgeMin} years old.`,
        ];
      }
    }

    if (props.includes('email')) {
      // check for a valid email address
      if (!this.data.email || !isEmail(this.data.email)) {
        invalids = [
          ...invalids,
          'Invalid email',
        ];
      }
    }

    if (props.includes('name')) {
      const {
        userFullNameMax,
        userFullNameMin,
      } = Constants.EntityLimits;

      if (!this.data.name || this.data.name.length < userFullNameMin) {
        invalids = [
          ...invalids,
          `Name has to be at least ${userFullNameMin} characters long.`,
        ];
      }
      else if (this.data.name.length > userFullNameMax) {
        invalids = [
          ...invalids,
          `Name cannot be more than ${userFullNameMax} characters long.`,
        ];
      }
    }

    if (props.includes('num_branches')) {
      if (Number.isNaN(this.data.num_branches)) {
        invalids = [
          ...invalids,
          'Invalid num_branches',
        ];
      }
    }

    if (props.includes('num_comments')) {
      if (Number.isNaN(this.data.num_comments)) {
        invalids = [
          ...invalids,
          'Invalid num_comments',
        ];
      }
    }

    if (props.includes('num_mod_positions')) {
      if (Number.isNaN(this.data.num_mod_positions)) {
        invalids = [
          ...invalids,
          'Invalid num_mod_positions',
        ];
      }
    }

    if (props.includes('num_posts')) {
      if (Number.isNaN(this.data.num_posts)) {
        invalids = [
          ...invalids,
          'Invalid num_posts',
        ];
      }
    }

    if (props.includes('password')) {
      const {
        userPasswordMax,
        userPasswordMin,
      } = Constants.EntityLimits;

      if (!this.data.password || this.data.password.length < userPasswordMin) {
        invalids = [
          ...invalids,
          `Password has to be at least ${userPasswordMin} characters long.`,
        ];
      }
      else if (this.data.password.length > userPasswordMax) {
        invalids = [
          ...invalids,
          `Password cannot be more than ${userPasswordMax} characters long.`,
        ];
      }
      else if (/\s/g.test(this.data.password)) {
        invalids = [
          ...invalids,
          'Password cannot contain spaces.',
        ];
      }
    }

    if (props.includes('show_nsfw')) {
      if (!validate.boolean(this.data.show_nsfw)) {
        invalids = [
          ...invalids,
          'Invalid show_nsfw',
        ];
      }
    }

    if (props.includes('username')) {
      if (!validate.username(this.data.username)) {
        invalids = [
          ...invalids,
          'Invalid username',
        ];
      }
    }

    if (props.includes('verified')) {
      if (!validate.boolean(this.data.verified)) {
        invalids = [
          ...invalids,
          'Invalid verified',
        ];
      }
    }

    return invalids;
  }
}

module.exports = User;
