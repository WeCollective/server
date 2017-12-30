const reqlib = require('app-root-path').require;

const algolia = reqlib('config/algolia');
const error = reqlib('responses/errors');
const success = reqlib('responses/successes');

module.exports.search = (req, res) => {
  const { q: query } = req.query;
  return algolia.search(query)
    .then(results => success.OK(res, { results }))
    .catch(() => error.InternalServerError(res));
};
