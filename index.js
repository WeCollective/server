// Loads environment variables from the .env file.
require('dotenv').config();

const bearerToken = require('express-bearer-token');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // reading cookies
const cors = require('cors');
const express = require('express');
const helmet = require('helmet'); // protect against common web vulnerabilities
const morgan = require('morgan');
const Raven = require('raven');
const reqlib = require('app-root-path').require;

const corsOptions = reqlib('config/cors')();
const passport = reqlib('config/passport')();

Raven
  .config('https://d53b586644e047b788637aa1c3ae035f:04519c04021c41d48e86fc6583f5ee99@sentry.io/271047')
  .install();

const app = express();
module.exports = app;

// Disable logging in test mode.
if (process.env.NODE_ENV === 'test') console.error = () => {};

// MIDDLEWARE
app.use(Raven.requestHandler());
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

// Handle successful request.
app.use((req, res, next) => { // eslint-disable-line no-unused-vars
  res.statusCode = 200;
  
  const success = {
    message: 'Success',
  };
  
  if (res.locals.data !== undefined) {
    success.data = res.locals.data;
  }

  console.log(JSON.stringify(success, null, 2));
  res.send(success);
});

// Handle errors.
app.use(Raven.errorHandler());
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  req.error = req.error || {};
  let message = req.error.message;
  const statusCode = req.error.status || 500;

  if (!message) {
    switch (statusCode) {
      case 400:
        message = 'The server could not process the request';
        break;

      case 403:
        message = 'Access denied';
        break;

      case 404:
        message = 'The requested resource couldn\'t be found';
        break;

      case 500:
      default:
        message = 'Something went wrong. We\'re looking into it.';
        break;
    }
  }

  console.log('❌ Sending back an error...');
  console.log(`Code: ${statusCode}`);
  console.log(`Message: ${message}`);

  res.statusCode = statusCode;
  res.send({ message });
});

// Start Slack integrations.
reqlib('slack');

// Open the port to accept incoming requests.
reqlib('listen');
