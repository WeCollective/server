module.exports = (Dynamite, validate) => {
  const CommentData = Dynamite.define('CommentData', {
    creator: {
      defaultValue: null,
      validate: validate.username,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    deleted: {
      defaultValue: false,
      validate: validate.boolean,
    },
    edited: {
      defaultValue: null,
      validate: validate.boolean,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.commentid,
    },
    text: {
      defaultValue: null,
      validate: {
        params: [1, validate.Constants.EntityLimits.commentText],
        test: validate.range,
      },
    },
  });

  return CommentData;
};
