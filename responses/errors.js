/* Module to send error responses to the client */

/**
 * @apiDefine BadRequest
 * @apiError (Errors) 400-BadRequest The server could not process the request due to missing or invalid parameters.
 * @apiErrorExample BadRequest:
 *     HTTP/1.1 400 BadRequest
 *     {
 *       "message": "Description of invalid parameter"
 *     }
 */
module.exports.BadRequest = (res, msg, rtnPromise) => {
  return this.code(res, 400, msg || 'The server could not process the request', rtnPromise);
};

module.exports.code = (res, code, msg, rtnPromise) => {
  console.log('❌ Sending back an error...');
  console.log(`Code: ${code}`);
  console.log(`Message: ${msg}`);
  res.statusCode = code || 500;
  res.send({ message: msg || 'Something went wrong. We\'re looking into it.'});

  if (rtnPromise) {
    return Promise.reject(code);
  }

  return false;
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
module.exports.Forbidden = (res, msg, rtnPromise) => {
  return this.code(res, 403, msg || 'Access denied', rtnPromise);
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
module.exports.NotFound = (res, msg, rtnPromise) => {
  return this.code(res, 404, msg || 'The requested resource couldn\'t be found', rtnPromise);
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
module.exports.InternalServerError = (res, msg, rtnPromise) => {
  return this.code(res, 500, msg || 'Something went wrong. We\'re looking into it.', rtnPromise);
};
