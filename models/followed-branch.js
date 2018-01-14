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
  }, {
    TableIndexes: [
      'branchid-index',
    ],
  });

  FollowedBranch.findByBranch = id => Dynamite.query({
    ExclusiveStartKey: null,
    ExpressionAttributeValues: {
      ':branchid': id,
    },
    IndexName: FollowedBranch.config.keys.TableIndexes[0],
    KeyConditionExpression: 'branchid = :branchid',
    ScanIndexForward: false,
    Select: 'ALL_PROJECTED_ATTRIBUTES',
  }, FollowedBranch, 'all');

  FollowedBranch.findByUsername = username => Dynamite.query({
    ExpressionAttributeValues: {
      ':username': username,
    },
    KeyConditionExpression: 'username = :username',
  }, FollowedBranch, 'all');

  return FollowedBranch;
};
