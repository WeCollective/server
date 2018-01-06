module.exports = (Dynamite, validate) => {
  const PostImage = Dynamite.define('PostImage', {
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
      validate: validate.postImageId,
    },
  });

  return PostImage;
};
