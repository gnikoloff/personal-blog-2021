require('dotenv').config()
const htmlToFormattedText = require('html-to-formatted-text')
const Prismic = require('prismic-javascript')
const PrismicDOM = require('prismic-dom')
const xml = require('xml')
const { SitemapStream, streamToPromise } = require('sitemap')
const { createGzip } = require('zlib')
const rfc822Date = require('rfc822-date')
const cache = require('memory-cache')
const sgMail = require('@sendgrid/mail')

const PrismicConfig = require('../prismic-configuration')
const app = require('../config')
const API = require('./API')

const { getPageTitle, decodeHTMLEntities } = require('./helpers')

const CACHE_TIMEOUT = 60 * 10
const PORT = app.get('port')
const WEBSITE_FULL_URL = 'https://archive.georgi-nikolov.com'
const PROJECT_TYPE_WORK = 'work'
const PROJECT_TYPE_SPEAKING = 'speaking'

const Elements = PrismicDOM.RichText.Elements

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const memCache = new cache.Cache()
const cacheMiddleware = (duration) => {
  if (process.env.ENVIRONMENT === 'development') {
    return (_, __, next) => next()
  }
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url
    let cacheContent = memCache.get(key)
    if (cacheContent) {
      res.send(cacheContent)
      return
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        memCache.put(key, body, duration * 1000)
        res.sendResponse(body)
      }
      next()
    }
  }
}

let sitemap

if (process.env.ENVIRONMENT === 'development') {
  app.listen(PORT, () => {
    process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`)
  })
}

const htmlSerializer = (type, element, content, children) => {
  let out
  if (type === Elements.preformatted) {
    const renderedChildren = children.join('')
    const lang = 'javascript' //renderedChildren.substring(0, renderedChildren.indexOf('*'))

    out = `<pre><code class="${lang}">${htmlToFormattedText(
      renderedChildren,
    )}</code></pre>`
  } else if (type === Elements.paragraph) {
    out = `<p>${decodeHTMLEntities(children.join(''))}</p>`
  } else if (type === Elements.listItem) {
    out = `<li>${decodeHTMLEntities(children.join(''))}</li>`
  } else if (type === Elements.oListItem) {
    out = `<li>${decodeHTMLEntities(children.join(''))}</li>`
  } else {
    return null
  }

  return out
}

// Middleware to inject prismic context
app.use((req, res, next) => {
  res.locals.ctx = {
    endpoint: PrismicConfig.apiEndpoint,
    linkResolver: PrismicConfig.linkResolver,
  }
  // add PrismicDOM in locals to access them in templates.
  res.locals.PrismicDOM = PrismicDOM
  Prismic.api(PrismicConfig.apiEndpoint, {
    accessToken: PrismicConfig.accessToken,
    req,
  })
    .then((api) => {
      req.prismic = { api }
      next()
    })
    .catch((error) => {
      next(error.message)
    })
})

app.get('/api/', cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  Promise.all([
    API.getInstance(req.prismic).fetchAllProjects({
      pageSize: 100,
      orderings: '[document.last_publication_date desc]',
    }),
    API.getInstance(req.prismic).fetchAllProjects(
      {
        pageSize: 100,
        orderings: '[document.last_publication_date desc]',
      },
      PROJECT_TYPE_SPEAKING,
    ),
  ]).then(
    ([
      { projectsRaw: projectsRawWorks },
      { projectsRaw: projectsRawSpeaking },
    ]) => {
      res.json([...projectsRawWorks, ...projectsRawSpeaking])
    },
  )

  // .then(({ projectsRaw }) => {
  //   res.json(projectsRaw)
  // })
})

app.get('*', cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  res.render('wip', {})
})

module.exports = app
