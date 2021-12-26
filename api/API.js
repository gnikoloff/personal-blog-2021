const Prismic = require('prismic-javascript')
// const NodeCache = require('node-cache')

const { getFormattedDate, getPageTitle } = require('./helpers')

const HOMEPAGE_CACHE_KEY = 'homepage'
const ABOUT_CACHE_KEY = 'about'
const BLOG_CACHE_KEY = 'blog'

let instance

class API {
  static getInstance(Prismic) {
    if (!instance) {
      instance = new API(Prismic)
    }
    return instance
  }
  constructor(Prismic) {
    this._Prismic = Prismic
    // this._cache = new NodeCache({ stdTTL: 100, checkperiod: 60 * 30 })
  }
  fetchAllProjects(opts, projectType = 'work') {
    return this._Prismic.api
      .query(Prismic.Predicates.at('document.type', projectType), opts)
      .then((response) => {
        const projects = (response.results || []).reduce((acc, item, i) => {
          const projectYear = parseInt(item.data.project_year[0].text, 10)
          if (!acc[projectYear]) {
            acc[projectYear] = [item]
          } else {
            acc[projectYear] = [...acc[projectYear], item]
          }
          return acc
        }, {})
        const projectsRaw = (response.results || []).sort(
          (a, b) =>
            parseInt(b.data.project_year[0].text, 10) -
            parseInt(a.data.project_year[0].text, 10),
        )
        const data = {
          projects,
          projectsRaw,
        }
        return data
      })
  }

  fetchAboutPage() {
    return this._Prismic.api
      .query(Prismic.Predicates.at('document.type', 'about'))
      .then((response) => {
        const document = response.results[0]
        // this._cache.set(ABOUT_CACHE_KEY, document)

        return document
      })
  }
  fetchBlog(opts) {
    // const aboutPage = this._cache.get(BLOG_CACHE_KEY)
    // if (aboutPage && process.env.ENVIRONMENT !== 'development') {
    //   return Promise.resolve(aboutPage)
    // }
    return this._Prismic.api
      .query(Prismic.Predicates.at('document.type', 'blog'), opts)
      .then((response) => {
        const projects = (response.results || []).map((project) => {
          const date = new Date(project.first_publication_date)
          const blogPage = {
            ...project,
            formattedDate: getFormattedDate(date),
          }
          return blogPage
        })

        // this._cache.set(BLOG_CACHE_KEY, projects)
        return projects
      })
  }
  fetchArticle(uid) {
    // const articlePge = this._cache.get(uid)
    // if (articlePge && process.env.ENVIRONMENT !== 'development') {
    //   return Promise.resolve(articlePge)
    // }
    return this._Prismic.api.getByUID('blog', uid).then((project) => {
      const date = new Date(project.first_publication_date)
      const articlePge = {
        title: getPageTitle(project.data.title[0].text),
        formattedDate: getFormattedDate(date),
        project,
      }
      // this._cache.set(uid, articlePge)
      return articlePge
    })
  }
}

module.exports = API
