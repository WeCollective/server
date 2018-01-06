module.exports = (Dynamite, validate) => {
  const Constant = Dynamite.define('Constant', {
    data: {
      defaultValue: null,
      validate: {
        params: ['$$id'],
        test: validate.wecoConstantValue,
      },
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.wecoConstantId,
    },
  });

  return Constant;
};
