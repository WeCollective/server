module.exports = (Dynamite, validate) => {
  const UserVote = Dynamite.define('UserVote', {
    direction: {
      defaultValue: null,
      validate: validate.voteDirection,
    },
    itemid: {
      defaultValue: null,
      sort: true,
      validate: null,
    },
    username: {
      defaultValue: null,
      primary: true,
      validate: validate.username,
    },
  });

  UserVote.findByUsernameAndItemId = (username, itemid) => Dynamite.query({
    ExpressionAttributeValues: {
      ':itemid': itemid,
      ':username': username,
    },
    KeyConditionExpression: 'username = :username AND itemid = :itemid',
  }, UserVote, 'first');

  return UserVote;
};
