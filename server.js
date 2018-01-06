// Loads environment variables from the .env file.
require('dotenv').config();

const bearerToken = require('express-bearer-token');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // reading cookies
const cors = require('cors');
const express = require('express');
const helmet = require('helmet'); // protect against common web vulnerabilities
const morgan = require('morgan');
const reqlib = require('app-root-path').require;

const corsOptions = reqlib('config/cors')();
const passport = reqlib('config/passport')();

const app = express();
module.exports = app;

// Disable logging in test mode.
if (process.env.NODE_ENV === 'test') console.error = () => {};

// MIDDLEWARE
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// REDIRECT TRAFFIC ON HTTP TO HTTPS
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure && 'https' !== req.get('X-Forwarded-Proto')) {
      res.redirect(`https://${req.get('Host') + req.url}`);
    }
    else {
      next();
    }
  });
}

// Request logging.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'common' : 'dev'));

// Cross-origin requests policy.
app.use(cors(corsOptions));

// User authentication and token management.
app.use(bearerToken());
app.use(passport.initialize());
app.use(passport.authenticate('jwt'));

// Render docs on this route.
app.use('/docs', express.static(`${__dirname}/docs`));

// Import routes.
reqlib('routers/');

// Open the port to accept incoming requests.
reqlib('listen');
