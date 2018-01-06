const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const error = reqlib('responses/errors');
const Models = reqlib('models/');
const success = reqlib('responses/successes');

const { WecoConstants } = Constants.AllowedValues;

module.exports.get = (req, res) => {
  const { id } = req.params;

  if (!WecoConstants.includes(id)) {
    return error.BadRequest(res, 'Invalid id parameter.');
  }

  return Models.Constant.findById(id)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Constant not found.',
          status: 404,
        });
      }

      return success.OK(res, {
        data: instance.get('data'),
        id: instance.get('id'),
      });
    })
    .catch(err => {
      console.error('Error fetching constant:', err);
      return error.InternalServerError(res, err);
    });
};

module.exports.getAll = (req, res) => Models.Constant.findAll({
  where: {
    id: WecoConstants,
  },
})
  .then(constants => success.OK(res, constants.map(instance => ({
    data: instance.get('data'),
    id: instance.get('id'),
  }))))
  .catch(err => {
    console.error('Error fetching constant:', err);
    return error.InternalServerError(res, err);
  });

module.exports.put = (req, res) => {
  const { data } = req.body;
  const { id } = req.params;
  const int = Number.parseInt(data, 10);

  if (!WecoConstants.includes(id)) {
    return error.BadRequest(res, 'Invalid id parameter.');
  }

  if (Number.isNaN(int)) {
    return error.BadRequest(res, 'Missing data parameter');
  }

  return Models.Constant.findById(id)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Constant not found.',
          status: 404,
        });
      }

      instance.set('data', int);
      return instance.update();
    })
    .then(() => success.OK(res))
    .catch(err => {
      console.error('Error fetching constant:', err);
      return error.InternalServerError(res, err);
    });
};
