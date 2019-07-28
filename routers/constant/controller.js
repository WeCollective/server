const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const Models = reqlib('models/');

const { WecoConstants } = Constants.AllowedValues;


module.exports.get = (req, res, next) => {
  const { id } = req.params;

  if (!WecoConstants.includes(id)) {
    req.error = {
      message: 'Invalid id parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.Constant.findById(id)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Constant not found.',
          status: 404,
        });
      }

      res.locals.data = {
        data: instance.get('data'),
        id: instance.get('id'),
      };
      return next();
    })
    .catch(err => {
      console.error('Error fetching constant:', err);
      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.getAll = (req, res, next) => {

  return Models.Constant.findAll({
    where: {
      id: WecoConstants,
    },
  })
    .then(constants => {
      res.locals.data = constants.map(instance => ({
        data: instance.get('data'),
        id: instance.get('id'),
      }));
      return next();
    })
    .catch(err => {
      console.error('Error fetching constant:', err);
      req.error = {

        message: err,
      };

      return next(JSON.stringify(req.error));
    });
};

module.exports.put = (req, res, next) => {
  const { data } = req.body;
  const { id } = req.params;
  const int = Number.parseInt(data, 10);

  if (!WecoConstants.includes(id)) {
    req.error = {
      message: 'Invalid id parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (Number.isNaN(int)) {
    req.error = {
      message: 'Missing data parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
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
    .then(() => next())
    .catch(err => {
      console.error('Error fetching constant:', err);
      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};
