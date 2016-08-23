'use strict';

/**
 * @apiDefine OK
 * @apiError (Successes) 200-OK The server successfully carried out the request.
 * @apiErrorExample OK:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Success"
 *     }
 */
module.exports.OK = function(res, data) {
  res.statusCode = 200;
  var success = {};
  success.message = 'Success';
  if(data) {
    success.data = data;
  }
  res.send(success);
};

/**
 * @apiDefine Created
 * @apiError (Successes) 201-Created The server successfully created a new resource.
 * @apiErrorExample Created:
 *     HTTP/1.1 201 Created
 *     {
 *       "message": "The request has been fulfilled and resulted in a new resource being created"
 *     }
 */
module.exports.Created = function(res) {
  res.statusCode = 201;
  var success = {};
  success.message = 'The request has been fulfilled and resulted in a new resource being created';
  res.send(success);
};
