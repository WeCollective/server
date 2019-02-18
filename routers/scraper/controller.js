const reqlib = require('app-root-path').require
const scrape = require('html-metadata')

const Constants = reqlib('config/constants')

const { PostTypePage } = Constants
const { url: UrlPolicy } = Constants.Policy

/**
 * @param {string} [type]
 *
 * @returns {string}
 */
const normalizePostType = type => {
  switch (type) {
    case 'article':
      return PostTypePage
    default:
      return ''
  }
}

/**
 * Attempts to return the original url if our scraper failed us and returned
 * bad url. We define bad urls as urls which are subclasses of the original
 * value, e.g. root domains.
 *
 * @param {string} original
 * @param {string} [scraped='']
 *
 * @returns {string} One of the passed urls.
 */
const normalizeUrl = (original, scraped = '') => {
  if (scraped && original.includes(scraped)) return original
  return scraped
}

module.exports.scrap = async (req, res, next) => {
  try {
    const { url } = req.query

    if (!url) throw {
      message: 'Missing url.',
      status: 400,
    }

    if (!UrlPolicy.test(url)) throw {
      message: 'Incorrect url.',
      status: 400,
    }

    const path = url.includes('http') ? url : `https://${url}`
    const data = await scrape(path)

    const general = data.general || {}
    const openGraph = data.openGraph || {}
    const type = normalizePostType(openGraph.type || general.type)

    res.locals.data = {
      text: openGraph.description || general.description || '',
      title: openGraph.title || general.title || '',
      type,
      url: normalizeUrl(url, openGraph.url || general.url || general.canonical),
    }
    next()
  }
  catch (e) {
    const error = typeof e === 'object' && e.status ? e : { message: e }
    req.error = error
    next(JSON.stringify(req.error))
  }

}
