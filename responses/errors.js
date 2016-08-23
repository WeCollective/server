/* Module to send error responses to the client */
'use strict';

/**
 * @apiDefine BadRequest
 * @apiError (Errors) 400-BadRequest The server could not process the request due to missing or invalid parameters.
 * @apiErrorExample BadRequest:
 *     HTTP/1.1 400 BadRequest
 *     {
 *       "message": "Description of invalid parameter"
 *     }
 */
module.exports.BadRequest = function(res, message) {
  res.statusCode = 400;
  var error = {};
  error.message = message || 'The server could not process the request';
  res.send(error);
  return Promise.reject();
};

/**
 * @apiDefine Forbidden
 * @apiError (Errors) 403-Forbidden The user does not have the necessary permissions to perform this request.
 * @apiErrorExample Forbidden:
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "message": "Access denied"
 *     }
 */
module.exports.Forbidden = function(res) {
  res.statusCode = 403;
  var error = {};
  error.message = 'Access denied';
  res.send(error);
  return Promise.reject();
};

/**
 * @apiDefine NotFound
 * @apiError (Errors) 404-NotFound The requested resource couldn't be found
 * @apiErrorExample Not Found:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "The requested resource couldn't be found"
 *     }
 */
module.exports.NotFound = function(res, message) {
  res.statusCode = 404;
  var error = {};
  error.message = message || 'The requested resource couldn\'t be found';
  res.send(error);
  return Promise.reject();
};

/**
 * @apiDefine InternalServerError
 * @apiError (Errors) 500-InternalServerError The server was unable to carry out the request due to an internal error.
 * @apiErrorExample InternalServerError:
 *     HTTP/1.1 500 InternalServerError
 *     {
 *       "message": "Something went wrong. We're looking into it."
 *     }
 */
module.exports.InternalServerError = function(res, message) {
  res.statusCode = 500;
  var error = {};
  error.message = message || 'Something went wrong. We\'re looking into it.';
  res.send(error);
  return Promise.reject();
};
