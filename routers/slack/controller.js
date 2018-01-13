// const reqlib = require('app-root-path').require;
module.exports.command = (req, res, next) => {
  console.log(req.body);
  res.locals.data = 'test';
  return next();
};
