const algolia = require('../../config/algolia');
const error = require('../../responses/errors');
const success = require('../../responses/successes');

module.exports.search = (req, res) => {
  const { q: query } = req.query;
  let username = '';

  if (req.user) {
    username = req.user.username;
  }

  console.log(query, username);

  /*
  const results = [{
    text: 'item 1',
  }, {
    text: 'item 2',
  }, {
    text: 'item 3',
  }, {
    text: 'item 4',
  }, {
    text: 'item 5',
  }];
  */

  return algolia.search(query)
    .then(results => success.OK(res, { results }))
    .catch(() => error.InternalServerError(res));
};
