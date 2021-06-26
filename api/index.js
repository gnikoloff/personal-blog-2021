const Prismic = require("prismic-javascript");
const PrismicDOM = require("prismic-dom");
const xml = require("xml");
const { SitemapStream, streamToPromise } = require("sitemap");
const { createGzip } = require("zlib");
const { Readable } = require("stream");
const rfc822Date = require("rfc822-date");
const cache = require("memory-cache");

const PrismicConfig = require("../prismic-configuration");
const app = require("../config");
const API = require("./API");

const { getPageTitle, decodeHTMLEntities } = require("./helpers");

const CACHE_TIMEOUT = 60 * 10;
const PORT = app.get("port");
const WEBSITE_FULL_URL = "https://archive.georgi-nikolov.com";
const Elements = PrismicDOM.RichText.Elements;

const memCache = new cache.Cache();
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    let key = "__express__" + req.originalUrl || req.url;
    let cacheContent = memCache.get(key);
    if (cacheContent) {
      res.send(cacheContent);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        memCache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
      next();
    }
  };
};

let sitemap;

if (process.env.ENVIRONMENT === "development") {
  app.listen(PORT, () => {
    process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
  });
}

const htmlSerializer = (type, element, content, children) => {
  if (type === Elements.preformatted) {
    const renderedChildren = children.join("");
    const lang = renderedChildren.substring(0, renderedChildren.indexOf("*"));
    return `<pre><code class="${lang}">${renderedChildren.substring(
      renderedChildren.indexOf("*") + 1
    )}</code></pre>`;
  } else if (type === Elements.paragraph) {
    return `<p>${decodeHTMLEntities(children.join(""))}</p>`;
  } else if (type === Elements.listItem) {
    return `<li>${decodeHTMLEntities(children.join(""))}</li>`;
  } else if (type === Elements.oListItem) {
    return `<li>${decodeHTMLEntities(children.join(""))}</li>`;
  } else {
    return null;
  }
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
  })
    .then((api) => {
      req.prismic = { api };
      next();
    })
    .catch((error) => {
      next(error.message);
    });
});

app.get("/", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  API.getInstance(req.prismic)
    .fetchAllProjects({ pageSize: 100 })
    .then(({ projects }) => {
      res.render("body", {
        title: getPageTitle("Home"),
        projects,
      });
    });
});

app.get("/project/:uid", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  API.getInstance(req.prismic)
    .fetchAllProjects({ pageSize: 100 })
    .then(({ projectsRaw }) => {
      const project = projectsRaw.find(({ uid }) => uid === req.params.uid);
      const projectIndex = projectsRaw.findIndex(
        ({ uid }) => uid === req.params.uid
      );

      let prevProjectIdx;
      let nextProjectIdx;

      if (projectIndex > 0) {
        prevProjectIdx = projectIndex - 1;
      } else {
        prevProjectIdx = projectsRaw.length - 1;
      }

      if (projectIndex < projectsRaw.length - 1) {
        nextProjectIdx = projectIndex + 1;
      } else {
        nextProjectIdx = 0;
      }

      const prevProjectUID = projectsRaw[prevProjectIdx].uid;
      const nextProjectUID = projectsRaw[nextProjectIdx].uid;

      const prevProjectName =
        projectsRaw[prevProjectIdx].data.project_title[0].text;
      const nextProjectName =
        projectsRaw[nextProjectIdx].data.project_title[0].text;

      res.render("single", {
        seoDescription: project.data.seo_description,
        title: getPageTitle(project.data.project_title[0].text),
        project,
        prevProjectLink: `/project/${prevProjectUID}`,
        nextProjectLink: `/project/${nextProjectUID}`,
        prevProjectName,
        nextProjectName,
        htmlSerializer,
      });
    });
});

app.get("/about", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  API.getInstance(req.prismic)
    .fetchAboutPage()
    .then((document) => {
      res.render("about", {
        title: getPageTitle("About"),
        document,
      });
    });
});

app.get("/blog", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  API.getInstance(req.prismic)
    .fetchBlog({
      pageSize: 100,
      orderings: "[document.last_publication_date desc]",
    })
    .then((projects) => {
      res.render("blog", {
        title: getPageTitle("Blog"),
        projects,
      });
    });
});

app.get("/blog/:uid", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  API.getInstance(req.prismic)
    .fetchArticle(req.params.uid)
    .then((articlePage) => {
      const pageData = {
        seoDescription: articlePage.project.data.seo_description,
        ...articlePage,
        htmlSerializer,
      };
      res.render("blog-single", pageData);
    });
});

app.get("/sitemap.xml", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  res.header("Content-Type", "application/xml");
  res.header("Content-Encoding", "gzip");
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
      url: "/",
      changefreq: "weekly",
      priority: 0.7,
    });
    smStream.write({
      url: "/about",
      changefreq: "monthly",
      priority: 0.3,
    });
    smStream.write({
      url: "/blog",
    }); // changefreq: 'weekly',  priority: 0.5

    const APIInstance = API.getInstance(req.prismic);

    Promise.all([
      APIInstance.fetchBlog({ pageSize: 50 }),
      APIInstance.fetchAllProjects({ pageSize: 100 }),
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
      streamToPromise(pipeline).then((sm) => (sitemap = sm));
      // make sure to attach a write stream such as streamToPromise before ending
      smStream.end();
      // stream write the response
      pipeline.pipe(res).on("error", (e) => {
        throw e;
      });
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

app.get("/feed.rss", cacheMiddleware(CACHE_TIMEOUT), (req, res) => {
  const APIInstance = API.getInstance(req.prismic);
  Promise.all([
    APIInstance.fetchBlog({ pageSize: 50 }),
    APIInstance.fetchAllProjects({ pageSize: 100 }),
  ]).then((responses) => {
    const blogPorts = responses[0] ? responses[0] : [];
    const posts = responses[1] ? responses[1] : {};

    const projects = posts.projectsRaw;
    const xmlObject = {
      rss: [
        {
          _attr: {
            version: "2.0",
            "xmlns:atom": "http://www.w3.org/2005/Atom",
          },
        },
        {
          channel: [
            {
              "atom:link": {
                _attr: {
                  href: `${WEBSITE_FULL_URL}/feed.rss`,
                  rel: "self",
                  type: "application/rss+xml",
                },
              },
            },
            { title: "Georgi Nikolov" },
            { link: WEBSITE_FULL_URL },
            {
              description:
                "Website for blog articles and works by Georgi Nikolov, a frontend developer living in Berlin, Germany.",
            },
            { language: "en-us" },
            ...projects.map((project) => {
              const absoluteHREF = `${WEBSITE_FULL_URL}/project/${project.uid}`;
              const postDate = rfc822Date(
                new Date(project.first_publication_date)
              );
              return {
                item: [
                  { title: project.data.project_title[0].text },
                  { author: "nikoloffgeorgi@gmail.com" },
                  { pubDate: postDate },
                  { link: absoluteHREF },
                  { guid: absoluteHREF },
                  {
                    description: {
                      _cdata: PrismicDOM.RichText.asHtml(
                        project.data.project_body
                      ),
                    },
                  },
                ],
              };
            }),
            ...blogPorts.map((article) => {
              const absoluteHREF = `${WEBSITE_FULL_URL}/blog/${article.uid}`;
              const postDate = rfc822Date(
                new Date(article.first_publication_date)
              );
              return {
                item: [
                  { title: article.data.title[0].text },
                  { author: "nikoloffgeorgi@gmail.com" },
                  { pubDate: postDate },
                  { link: absoluteHREF },
                  { guid: absoluteHREF },
                  {
                    description: {
                      _cdata: PrismicDOM.RichText.asHtml(article.data.body),
                    },
                  },
                ],
              };
            }),
          ],
        },
      ],
    };
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>${xml(xmlObject)}`;
    res.set("Content-Type", "text/xml");
    res.send(xmlString);
  });
});

module.exports = app;
