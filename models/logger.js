module.exports = (Dynamite, validate) => { // eslint-disable-line no-unused-vars
  const Logger = Dynamite.define('Logger', {
    createdAt: {
      defaultValue: null,
      sort: true,
      validate: null,
    },
    event: {
      defaultValue: null,
      primary: true,
      validate: null,
    },
    extra: {
      defaultValue: null,
      validate: null,
    },
  });

  Logger.record = (eventType, extra) => Logger.create({
    createdAt: Date.now(),
    event: eventType,
    extra,
  });

  return Logger;
};
