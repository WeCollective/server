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
module.exports.OK = (res, data) => {
  res.statusCode = 200;
  
  let success = { message: 'Success' };
  
  if (data) {
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
module.exports.Created = res => {
  res.statusCode = 201;
  const success = { message: `The request has been fulfilled and resulted in a new resource being created` };
  res.send(success);
};
