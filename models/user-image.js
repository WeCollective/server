module.exports = (Dynamite, validate) => {
  const UserImage = Dynamite.define('UserImage', {
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
      validate: validate.userImageId,
    },
  });

  return UserImage;
};
