module.exports = (Dynamite, validate) => {
  const PostData = Dynamite.define('PostData', {
    creator: {
      defaultValue: null,
      validate: validate.username,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.postid,
    },
    original_branches: {
      defaultValue: null,
      validate: validate.originalBranches,
    },
    text: {
      defaultValue: null,
      validate: validate.postText,
    },
    title: {
      defaultValue: null,
      validate: {
        params: [1, validate.Constants.EntityLimits.postTitle],
        test: validate.range,
      },
    },
    type: {
      defaultValue: null,
      validate: validate.postType,
    },
  });

  return PostData;
};
