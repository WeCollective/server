const http = require('http');
const reqlib = require('app-root-path').require;
const urlLib = require('url');

const app = reqlib('/');
const error = reqlib('responses/errors');

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
app.get(`${version}/proxy`, (req, res) => {
  const { url } = req.query;

  if (!url) {
    return error.NotFound(res);
  }

  const url_parts = urlLib.parse(url, true);

  if (url_parts.protocol !== 'http:') {
    return error.BadRequest(res, 'Only http resources can be proxied');
  }

  http.get(url, response => {
    if (response.statusCode === 200) {
      res.writeHead(200, {
        'Content-Type': response.headers['content-type']
      });
      response.pipe(res);
    }
    else {
      return error.NotFound(res);
    }
  })
    .on('error', () => error.BadRequest(res, 'Invalid URL parameter'));
});

app.use(`${version}/branch`, getRouter('branch'));
app.use(`${version}/branch/:branchid/mods`, getRouter('mods'));
app.use(`${version}/branch/:branchid/posts`, getRouter('branch-posts'));
app.use(`${version}/branch/:branchid/requests/subbranches`, getRouter('requests'));
app.use(`${version}/constant`, getRouter('constant'));
app.use(`${version}/poll`, getRouter('poll'));
app.use(`${version}/post`, getRouter('post'));
app.use(`${version}/search`, getRouter('search'));
app.use(`${version}/user`, getRouter('user'));
