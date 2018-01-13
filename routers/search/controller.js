const reqlib = require('app-root-path').require;

const algolia = reqlib('config/algolia');

module.exports.search = (req, res, next) => {
  const { q: query } = req.query;
  return algolia.search(query)
    .then(results => {
      res.locals.data = { results };
      return next();
    })
    .catch(() => next(true));
};
