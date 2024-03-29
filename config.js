/**
 * Module dependencies.
 */
const express = require('express')
const favicon = require('serve-favicon')
const bodyParser = require('body-parser')
const methodOverride = require('method-override')
const errorHandler = require('errorhandler')
const compression = require('compression')
const cors = require('cors')
const path = require('path')

module.exports = (() => {
  const app = express()

  // all environments
  app.set('port', process.env.PORT || 3001)
  app.set('views', path.join(__dirname, 'views'))
  app.set('view engine', 'pug')
  // app.use(favicon('public/images/punch.png'));
  // app.use(logger('dev'));
  app.use(cors())
  app.use(compression())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(methodOverride())
  app.use(express.static(path.join(__dirname, 'dist')))

  app.use(errorHandler())

  return app
})()
