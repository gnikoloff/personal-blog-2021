const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const request = require('request');
const PrismicConfig = require('./prismic-configuration');
const app = require('./config');

const PORT = app.get('port');

const getPageTitle = title => `${title} | Georgi Nikolov`;

app.listen(PORT, () => {
  process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
});

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
    { pageSize: 100 }
  ).then((response) => {
    const projects = (response.results || []).reduce((acc, item, i) => {
      const projectYear = parseInt(item.data.project_year[0].text);
      if (!acc[projectYear]) {
        acc[projectYear] = [ item ];
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
  req.prismic.api.getByUID('work', req.params.uid).then(project => {
    res.render('single', {
      title: getPageTitle(project.data.project_title[0].text),
      project,
    });
  });
});

app.get('/about', (req, res) => {
  req.prismic.api.query(
    Prismic.Predicates.at('document.type', 'about'),
  ).then(response => {
    const document = response.results[0];
    res.render('about', {
      title: getPageTitle('About'),
      document,
    });
  });
});
