module.exports = (Dynamite, validate) => {
  const Tag = Dynamite.define('Tag', {
    branchid: {
      defaultValue: null,
      primary: true,
      validate: validate.branchid,
    },
    tag: {
      defaultValue: null,
      sort: true,
      validate: validate.branchid,
    },
  }, {
    TableIndexes: [
      'tag-branchid-index',
    ],
  });

  Tag.findByBranch = branchid => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': branchid,
    },
    KeyConditionExpression: 'branchid = :id',
  }, Tag, 'all');

  Tag.findByTag = tag => Dynamite.query({
    ExpressionAttributeValues: {
      ':tag': tag,
    },
    IndexName: Tag.config.keys.TableIndexes[0],
    KeyConditionExpression: 'tag = :tag',
  }, Tag, 'all');

  Tag.findByBranchAndTag = (branchid, tag) => Dynamite.query({
    ExpressionAttributeValues: {
      ':branchid': branchid,
      ':tag': tag,
    },
    KeyConditionExpression: 'branchid = :branchid AND tag = :tag',
  }, Tag, 'first');

  return Tag;
};
