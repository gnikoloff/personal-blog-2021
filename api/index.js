const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const xml = require('xml');
const { SitemapStream, streamToPromise } = require('sitemap');
const { createGzip } = require('zlib');
const { Readable } = require('stream');
const rfc822Date = require('rfc822-date');

const PrismicConfig = require('../prismic-configuration');
const app = require('../config');
const API = require('./API');

const {
  getPageTitle,
} = require('./helpers');

const PORT = app.get('port');
const WEBSITE_FULL_URL = 'https://archive.georgi-nikolov.com';

let sitemap;

if (process.env.ENVIRONMENT === 'development') {
  app.listen(PORT, () => {
    process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
  });
}

// Middleware to inject prismic context
app.use((req, res, next) => {
  res.locals.ctx = {
    endpoint: PrismicConfig.apiEndpoint,
    linkResolver: PrismicConfig.linkResolver,
  };
  // add PrismicDOM in locals to access them in templates.
  res.locals.PrismicDOM = PrismicDOM;
  Prismic.api(PrismicConfig.apiEndpoint, {
    accessToken: PrismicConfig.accessToken,
    req,
  }).then((api) => {
    req.prismic = { api };
    next();
  }).catch((error) => {
    next(error.message);
  });
});

app.get('/', (req, res) => {
  API
    .getInstance(req.prismic)
    .fetchHomepage({ pageSize: 100 })
    .then(({ projects }) => {
      res.render('body', {
        title: getPageTitle('Home'),
        projects,
      });
    });
});

app.get('/project/:uid', (req, res) => {
  API
    .getInstance(req.prismic)
    .fetchWork(req.params.uid)
    .then((project) => {
      res.render('single', {
        seoDescription: project.data.seo_description,
        title: getPageTitle(project.data.project_title[0].text),
        project,
      });
    });
});

app.get('/about', (req, res) => {
  API
    .getInstance(req.prismic)
    .fetchAboutPage()
    .then((document) => {
      res.render('about', {
        title: getPageTitle('About'),
        document,
      });
    });
});

app.get('/blog', (req, res) => {
  API
    .getInstance(req.prismic)
    .fetchBlog({ pageSize: 100 })
    .then((projects) => {
      res.render('blog', {
        title: getPageTitle('Blog'),
        projects,
      });
    });
});

app.get('/blog/:uid', (req, res) => {
  API
    .getInstance(req.prismic)
    .fetchArticle(req.params.uid)
    .then((articlePage) => {
      const pageData = {
        seoDescription: articlePage.project.data.seo_description,
        ...articlePage
      };
      res.render('blog-single', pageData);
    });
});

app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  res.header('Content-Encoding', 'gzip');
  // if we have a cached entry send it
  if (sitemap) {
    res.send(sitemap);
    return;
  }

  try {
    const smStream = new SitemapStream({ hostname: WEBSITE_FULL_URL });
    const pipeline = smStream.pipe(createGzip());

    // pipe your entries or directly write them.
    smStream.write({
      url: '/',
      changefreq: 'weekly',
      priority: 0.7,
    });
    smStream.write({
      url: '/about',
      changefreq: 'monthly',
      priority: 0.3,
    });
    smStream.write({
      url: '/blog',
    }); // changefreq: 'weekly',  priority: 0.5

    const APIInstance = API.getInstance(req.prismic);

    Promise.all([
      APIInstance.fetchBlog({ pageSize: 50 }),
      APIInstance.fetchHomepage({ pageSize: 50 }),
    ]).then((responses) => {
      const blogPorts = responses[0] ? responses[0] : [];

      const posts = responses[1];
      const projects = posts ? posts.projects : [];

      blogPorts.forEach((blog) => {
        smStream.write({
          url: `/blog/${blog.uid}`,
        });
      });

      Object.values(projects).forEach((projects) => {
        Object.values(projects).forEach((project) => {
          smStream.write({
            url: `/project/${project.uid}`,
            img: project.data.project_image.url,
          });
        });
      });
      // cache the response
      streamToPromise(pipeline).then(sm => sitemap = sm);
      // make sure to attach a write stream such as streamToPromise before ending
      smStream.end();
      // stream write the response
      pipeline.pipe(res).on('error', (e) => { throw e; });
    });

    /* or use
    Readable.from([{url: '/page-1'}...]).pipe(smStream)
    if you are looking to avoid writing your own loop.
    */
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get('/feed.rss', (req, res) => {
  const APIInstance = API.getInstance(req.prismic);
  Promise.all([
    APIInstance.fetchBlog({ pageSize: 50 }),
    APIInstance.fetchHomepage({ pageSize: 50 }),
  ]).then((responses) => {
    const blogPorts = responses[0] ? responses[0] : [];
    const posts = responses[1] ? responses[1] : {};

    const projects = posts.projectsRaw;
    const xmlObject = {
      rss: [
        {
          _attr: {
            version: '2.0',
            'xmlns:atom': 'http://www.w3.org/2005/Atom',
          },
        },
        {
          channel: [
            {
              'atom:link': {
                _attr: {
                  href: `${WEBSITE_FULL_URL}/feed.rss`,
                  rel: 'self',
                  type: 'application/rss+xml',
                },
              },
            },
            { title: 'Georgi Nikolov' },
            { link: WEBSITE_FULL_URL },
            { description: 'Website for blog articles and works by Georgi Nikolov, a frontend developer living in Berlin, Germany.' },
            { language: 'en-us' },
            ...projects.map((project) => {
              const absoluteHREF = `${WEBSITE_FULL_URL}/project/${project.uid}`;
              const postDate = rfc822Date(new Date(project.first_publication_date));
              return {
                item: [
                  { title: project.data.project_title[0].text },
                  { author: 'nikoloffgeorgi@gmail.com' },
                  { pubDate: postDate },
                  { link: absoluteHREF },
                  { guid: absoluteHREF },
                  { description: { _cdata: PrismicDOM.RichText.asHtml(project.data.project_body) } },
                ],
              };
            }),
            ...blogPorts.map((article) => {
              const absoluteHREF = `${WEBSITE_FULL_URL}/blog/${article.uid}`;
              const postDate = rfc822Date(new Date(article.first_publication_date));
              return {
                item: [
                  { title: article.data.title[0].text },
                  { author: 'nikoloffgeorgi@gmail.com' },
                  { pubDate: postDate },
                  { link: absoluteHREF },
                  { guid: absoluteHREF },
                  { description: { _cdata: PrismicDOM.RichText.asHtml(article.data.body) } },
                ],
              };
            }),
          ],
        },
      ],
    };
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>${xml(xmlObject)}`;
    res.set('Content-Type', 'text/xml');
    res.send(xmlString);
  });
});

module.exports = app;
