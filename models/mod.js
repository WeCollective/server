module.exports = (Dynamite, validate) => {
  const Mod = Dynamite.define('Mod', {
    branchid: {
      defaultValue: null,
      primary: true,
      validate: validate.branchid,
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
  });

  Mod.findByBranch = id => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': id,
    },
    KeyConditionExpression: 'branchid = :id',
  }, Mod, 'all');

  return Mod;
};
