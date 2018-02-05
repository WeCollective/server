const reqlib = require('app-root-path').require;
const scrape = require('html-metadata');

const Constants = reqlib('config/constants');

const { PostTypePage } = Constants;
const { url: UrlPolicy } = Constants.Policy;

module.exports.scrap = (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    req.error = {
      message: 'Missing url.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  const path = url.includes('http') ? url : `https://${url}`;

  if (!UrlPolicy.test(url)) {
    req.error = {
      message: 'Incorrect url.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return scrape(path)
    .then(data => {
      const general = data.general || {};
      const openGraph = data.openGraph || {};
      let type = openGraph.type || general.type || '';

      switch (type) {
        case 'article':
          type = PostTypePage;
          break;

        default:
          type = '';
          break;
      }

      const response = {
        text: openGraph.description || general.description || '',
        title: openGraph.title || general.title || '',
        type,
        url: openGraph.url || general.url || general.canonical || '',
      };
      return Promise.resolve(response);
    })
    .catch(err => {
      console.log(err);
      return Promise.resolve();
    })
    .then(data => {
      res.locals.data = data;
      return next();
    });
};
