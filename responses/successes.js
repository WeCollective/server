'use strict';

module.exports.OK = function(res, data) {
  res.statusCode = 200;
  var success = {};
  success.message = 'Success';
  if(data) {
    success.data = data;
  }
  res.send(success);
};
module.exports.Created = function(res) {
  res.statusCode = 201;
  var success = {};
  success.message = 'The request has been fulfilled and resulted in a new resource being created';
  res.send(success);
};
