const algolia = require('../../config/algolia');
const error = require('../../responses/errors');
const success = require('../../responses/successes');

module.exports.search = (req, res) => {
  const { q: query } = req.query;
  return algolia.search(query)
    .then(results => success.OK(res, { results }))
    .catch(() => error.InternalServerError(res));
};
