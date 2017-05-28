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
module.exports.BadRequest = (res, msg) => {
  res.statusCode = 400;
  res.send({ message: msg || `The server could not process the request` });
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
module.exports.Forbidden = res => {
  res.statusCode = 403;
  res.send({ message: 'Access denied' });
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
module.exports.NotFound = (res, msg) => {
  res.statusCode = 404;
  res.send({ message: msg || `The requested resource couldn't be found` });
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
module.exports.InternalServerError = (res, msg) => {
  res.statusCode = 500;
  res.send({ message: msg || `Something went wrong. We're looking into it.` });
  return Promise.reject();
};