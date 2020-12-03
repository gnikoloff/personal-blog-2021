const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const PrismicConfig = require('../prismic-configuration');
const app = require('../config');

const { SitemapStream, streamToPromise } = require('sitemap');
const { createGzip } = require('zlib');
const { Readable } = require('stream');

const PORT = app.get('port');

let sitemap;


const getPageTitle = title => `${title} | Georgi Nikolov`;

if (process.env.ENVIRONMENT === 'development') {
  app.listen(PORT, () => {
    process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
  });
}

const getFormattedDate = (date) => {
  const formatNumber = (number) => {
    let numberFormat;
    if (number < 10) {
      numberFormat = `0${number}`;
    } else {
      numberFormat = number.toString();
    }
    return numberFormat;
  };
  const day = formatNumber(date.getDay());
  const month = formatNumber(date.getMonth());
  const year = formatNumber(date.getFullYear());

  return `${day}.${month}.${year}`;
};

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
  req.prismic.api.query(
    Prismic.Predicates.at('document.type', 'work'),
    { pageSize: 100 },
  ).then((response) => {
    const projects = (response.results || []).reduce((acc, item, i) => {
      const projectYear = parseInt(item.data.project_year[0].text, 10);
      if (!acc[projectYear]) {
        acc[projectYear] = [item];
      } else {
        acc[projectYear] = [
          ...acc[projectYear],
          item,
        ];
      }
      return acc;
    }, {});

    res.render('body', {
      title: getPageTitle('Home'),
      projects,
    });
  });
});

app.get('/project/:uid', (req, res) => {
  req.prismic.api.getByUID('work', req.params.uid).then((project) => {
    res.render('single', {
      title: getPageTitle(project.data.project_title[0].text),
      project,
    });
  });
});

app.get('/about', (req, res) => {
  req.prismic.api.query(Prismic.Predicates.at('document.type', 'about')).then((response) => {
    const document = response.results[0];
    res.render('about', {
      title: getPageTitle('About'),
      document,
    });
  });
});

app.get('/blog', (req, res) => {
  req.prismic.api.query(
    Prismic.Predicates.at('document.type', 'blog'),
    { pageSize: 100 },
  ).then((response) => {
    const projects = (response.results || []).map((project) => {
      const date = new Date(project.first_publication_date);
      return {
        ...project,
        formattedDate: getFormattedDate(date),
      };
    });
    res.render('blog', {
      title: getPageTitle('Blog'),
      projects,
    });
  });
});

app.get('/blog/:uid', (req, res) => {
  req.prismic.api.getByUID('blog', req.params.uid).then((project) => {
    const date = new Date(project.first_publication_date);
    res.render('blog-single', {
      title: getPageTitle(project.data.title[0].text),
      formattedDate: getFormattedDate(date),
      project,
    });
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
