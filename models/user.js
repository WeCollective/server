module.exports = (Dynamite, validate) => {
  const User = Dynamite.define('User', {
    banned: {
      allowNull: true,
      defaultValue: null,
      validate: validate.boolean,
    },
    datejoined: {
      defaultValue: null,
      validate: validate.date,
    },
    dob: {
      allowNull: true,
      defaultValue: null,
      validate: validate.age,
    },
    email: {
      defaultValue: null,
      validate: validate.email,
    },
    name: {
      defaultValue: null,
      validate: {
        params: [
          validate.Constants.EntityLimits.userFullNameMin,
          validate.Constants.EntityLimits.userFullNameMax,
        ],
        test: validate.range,
      },
    },
    num_branches: {
      defaultValue: null,
      validate: validate.number,
    },
    num_comments: {
      defaultValue: null,
      validate: validate.number,
    },
    num_mod_positions: {
      defaultValue: null,
      validate: validate.number,
    },
    num_posts: {
      defaultValue: null,
      validate: validate.number,
    },
    password: {
      defaultValue: null,
      validate: {
        params: [60],
        test: validate.length,
      },
    },
    resetPasswordToken: {
      defaultValue: null,
      validate: null,
    },
    show_nsfw: {
      defaultValue: null,
      validate: validate.boolean,
    },
    token: {
      defaultValue: null,
      validate: null,
    },
    username: {
      defaultValue: null,
      primary: true,
      validate: validate.username,
    },
    verified: {
      defaultValue: null,
      validate: validate.boolean,
    },
  }, {
    TableIndexes: [
      'email-index',
    ],
  });

  User.findByEmail = email => Dynamite.query({
    ExpressionAttributeValues: {
      ':email': email,
    },
    IndexName: User.config.keys.TableIndexes[0],
    KeyConditionExpression: 'email = :email',
    ScanIndexForward: false, // return results highest first
    Select: 'ALL_PROJECTED_ATTRIBUTES',
  }, User, 'first');










  User.findLooselyByUsername = (query) => {
    var params = {};

    params.ExpressionAttributeNames = { '#username': 'username' };
    params.ExpressionAttributeValues = {
      ':username': query,
    };

    params.FilterExpression = 'contains(#username, :username)';

    params.ScanIndexForward = false;   // return results highest first
    params.Select = 'ALL_ATTRIBUTES';

    return Dynamite.scan(params, User, 'slice');

  };


  return User;
};
