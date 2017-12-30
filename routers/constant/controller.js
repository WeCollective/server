const Constant = require('../../models/constant');
const error = require('../../responses/errors');
const success = require('../../responses/successes');

module.exports.get = (req, res) => {
  const id = req.params.id;
  const wecoConstant = new Constant();

  if (!id) {
    return error.BadRequest(res, 'Missing id parameter');
  }
  
  return wecoConstant
    .findById(id)
    .then(() => success.OK(res, wecoConstant.data))
    .catch(err => {
      if (err) {
        console.error('Error fetching constant:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.getAll = (req, res) => {
  const types = [
    'branch_count',
    'donation_total',
    'raised_total',
    'user_count',
  ];
  const wecoConstant = new Constant();
  
  return wecoConstant
    .findById(types)
    .then(() => success.OK(res, wecoConstant.data))
    .catch(err => {
      if (err) {
        console.error('Error fetching constant:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.put = (req, res) => {
  const data = req.body.data;
  const id = req.params.id;
  const wecoConstant = new Constant();

  if (!id) {
    return error.BadRequest(res, 'Missing id parameter');
  }

  if (!data && data !== 0) {
    return error.BadRequest(res, 'Missing data parameter');
  }

  return wecoConstant
    .findById(id)
    .then(() => {
      let integer;

      if (['branch_count', 'donation_total', 'raised_total', 'user_count'].includes(id)) {
        integer = Number(data);
      }

      wecoConstant.set('data', integer);

      const invalids = wecoConstant.validate();
      if (invalids.length > 0) {
        return Promise.reject({
          code: 400,
          message: `Invalid ${invalids[0]}`,
        });
      }

      return wecoConstant.update();
    })
    .then(() => success.OK(res))
    .catch(err => {
      if (err) {
        console.error('Error fetching constant:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};
