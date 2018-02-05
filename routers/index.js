const http = require('http');
const reqlib = require('app-root-path').require;
const urlLib = require('url');

const app = reqlib('/');

const version = '/v1';

const getRouter = dir => reqlib(`routers/${dir}/router`)(app);

// Route used to proxy resources on insecure endpoints through
// this secure server to ensure all content is served over https.
// URL of resource should be supplied as a query argument.

/**
 * @api {get} /proxy Proxy insecure resource
 * @apiName Proxy insecure resource
 * @apiDescription Proxy a resource on an insecure endpoint over https
 * @apiGroup Misc
 * @apiPermission guest
 * @apiVersion 1.0.0
 *
 * @apiParam (URL Parameters) {String} url The url of the resource to proxy
 *
 * @apiUse OK
 * @apiUse Forbidden
 * @apiUse InternalServerError
 */
app.get(`${version}/proxy`, (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    req.error = {
      status: 404,
    };
    return next(JSON.stringify(req.error));
  }

  const url_parts = urlLib.parse(url, true);

  if (url_parts.protocol !== 'http:') {
    req.error = {
      message: 'Only http resources can be proxied.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  http.get(url, response => {
    if (response.statusCode === 200) {
      res.writeHead(200, {
        'Content-Type': response.headers['content-type']
      });
      response.pipe(res);
    }
    else {
      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    }
  })
    .on('error', () => {
      req.error = {
        message: 'Invalid URL parameter.',
        status: 400,
      };
      return next(JSON.stringify(req.error));
    });
});

app.use(`${version}/branch`, getRouter('branch'));
app.use(`${version}/branch/:branchid/mods`, getRouter('mods'));
app.use(`${version}/branch/:branchid/posts`, getRouter('branch-posts'));
app.use(`${version}/branch/:branchid/requests/subbranches`, getRouter('requests'));
app.use(`${version}/constant`, getRouter('constant'));
app.use(`${version}/poll`, getRouter('poll'));
app.use(`${version}/post`, getRouter('post'));
app.use(`${version}/scraper`, getRouter('scraper'));
app.use(`${version}/search`, getRouter('search'));
app.use(`${version}/slack`, getRouter('slack'));
app.use(`${version}/user`, getRouter('user'));

/**
 * @apiDefine BadRequest
 * @apiError (Errors) 400-BadRequest The server could not process the request due to missing or invalid parameters.
 * @apiErrorExample BadRequest:
 *     HTTP/1.1 400 BadRequest
 *     {
 *       "message": "Description of invalid parameter"
 *     }
 */
/**
 * @apiDefine Forbidden
 * @apiError (Errors) 403-Forbidden The user does not have the necessary permissions to perform this request.
 * @apiErrorExample Forbidden:
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "message": "Access denied"
 *     }
 */
/**
 * @apiDefine NotFound
 * @apiError (Errors) 404-NotFound The requested resource couldn't be found
 * @apiErrorExample Not Found:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "The requested resource couldn't be found"
 *     }
 */
/**
 * @apiDefine InternalServerError
 * @apiError (Errors) 500-InternalServerError The server was unable to carry out the request due to an internal error.
 * @apiErrorExample InternalServerError:
 *     HTTP/1.1 500 InternalServerError
 *     {
 *       "message": "Something went wrong. We're looking into it."
 *     }
 */
/**
 * @apiDefine OK
 * @apiError (Successes) 200-OK The server successfully carried out the request.
 * @apiErrorExample OK:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Success"
 *     }
 */
 