module.exports = (Dynamite, validate) => {
  const FollowedBranch = Dynamite.define('FollowedBranch', {
    branchid: {
      defaultValue: null,
      sort: true,
      validate: validate.branchid,
    },
    username: {
      defaultValue: null,
      primary: true,
      validate: validate.username,
    },
  });

  FollowedBranch.findByUsername = username => Dynamite.query({
    ExpressionAttributeValues: {
      ':username': username,
    },
    KeyConditionExpression: 'username = :username',
  }, FollowedBranch, 'all');

  return FollowedBranch;
};
