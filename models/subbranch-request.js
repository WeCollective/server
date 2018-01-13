module.exports = (Dynamite, validate) => {
  const SubBranchRequest = Dynamite.define('SubBranchRequest', {
    childid: {
      defaultValue: null,
      sort: true,
      validate: validate.branchid,
    },
    creator: {
      defaultValue: null,
      validate: validate.username,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    parentid: {
      defaultValue: null,
      primary: true,
      validate: validate.branchid,
    },
  }, {
    TableIndexes: [
      'parentid-date-index',
      'childid-date-index',
    ],
  });

  SubBranchRequest.find = (parentid, childid) => Dynamite.query({
    ExpressionAttributeValues: {
      ':childid': childid,
      ':parentid': parentid,
    },
    KeyConditionExpression: 'parentid = :parentid and childid = :childid',
  }, SubBranchRequest, 'all');

  SubBranchRequest.findByChild = id => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': id,
    },
    IndexName: SubBranchRequest.config.keys.TableIndexes[1],
    KeyConditionExpression: 'childid = :id',
    // return results newest first
    ScanIndexForward: false,
  }, SubBranchRequest, 'all');

  SubBranchRequest.findByParent = id => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': id,
    },
    IndexName: SubBranchRequest.config.keys.TableIndexes[0],
    KeyConditionExpression: 'parentid = :id',
    // return results newest first
    ScanIndexForward: false,
  }, SubBranchRequest, 'all');

  return SubBranchRequest;
};
