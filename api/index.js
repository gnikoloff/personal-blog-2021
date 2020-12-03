const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const { SitemapStream, streamToPromise } = require('sitemap');
const { createGzip } = require('zlib');
const { Readable } = require('stream');

const PrismicConfig = require('../prismic-configuration');
const app = require('../config');
const API = require('./API');

const {
  getPageTitle,
} = require('./helpers');

const PORT = app.get('port');

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
      res.render('blog-single', articlePage);
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
    const siteURL = 'https://personal-blog-2021.vercel.app/';
    const smStream = new SitemapStream({ hostname: siteURL });
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

    Promise.all([
      req.prismic.api.query(
        Prismic.Predicates.at('document.type', 'blog'),
        { pageSize: 100 },
      ),
      req.prismic.api.query(
        Prismic.Predicates.at('document.type', 'work'),
        { pageSize: 100 },
      ),
    ]).then((responses) => {
      const blogPorts = responses[0] ? responses[0].results : [];

      const posts = responses[1];
      const projects = posts ? posts.results : [];

      blogPorts.forEach((blog) => {
        smStream.write({
          url: `/blog/${blog.uid}`,
        });
      });
      projects.forEach((project) => {
        smStream.write({
          url: `/project/${project.uid}`,
          img: project.data.project_image.url,
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

module.exports = app;
