module.exports = (Dynamite, validate) => {
  const ModLog = Dynamite.define('ModLog', {
    action: {
      defaultValue: null,
      validate: validate.modLogAction,
    },
    branchid: {
      defaultValue: null,
      primary: true,
      validate: validate.branchid,
    },
    data: {
      defaultValue: null,
      validate: validate.exists,
    },
    date: {
      defaultValue: null,
      sort: true,
      validate: validate.date,
    },
    username: {
      defaultValue: null,
      validate: validate.username,
    },
  }, {
    pluralize: false,
  });

  ModLog.findByBranch = branchid => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': branchid,
    },
    KeyConditionExpression: 'branchid = :id',
    // Newest results first.
    ScanIndexForward: false,
  }, ModLog, 'all');

  return ModLog;
};
