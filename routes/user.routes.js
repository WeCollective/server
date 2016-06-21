'use strict';

var success = require('./responses/successes.js');

module.exports = {
  get:  function(req, res) {
    return success.OK(res, {
      message: "Welcome to the Users API!"
    });
  }
};
