module.exports = (Dynamite, validate) => {
  const BranchImage = Dynamite.define('BranchImage', {
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    extension: {
      defaultValue: null,
      validate: validate.extension,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.branchImageId,
    },
  });

  return BranchImage;
};
