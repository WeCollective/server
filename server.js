/*
  Copyright (c) 2017 WE COLLECTIVE

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

// REQUIRE MODULES
require('dotenv').config(); // load any environment variables from the .env file

const bearerToken = require('express-bearer-token');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // reading cookies
const express = require('express');
const helmet = require('helmet'); // protect against common web vulnerabilities
const morgan = require('morgan');

const clearConsole = require('./utils/clear-console');

const app = express(); // define our app using express

// DISABLE LOGGING IF IN TEST MODE
if (process.env.NODE_ENV === 'test') {
  console.error = () => {};
}

const port = process.env.PORT || 8080;

// MIDDLEWARE
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

// CROSS ORIGIN RESOURCE SHARING
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:8081',
    'https://localhost:8081',
    'http://webapp-dev.eu9ntpt33z.eu-west-1.elasticbeanstalk.com',
    'https://webapp-dev.eu9ntpt33z.eu-west-1.elasticbeanstalk.com',
    'http://webapp-prod.eu-west-1.elasticbeanstalk.com',
    'https://webapp-prod.eu-west-1.elasticbeanstalk.com',
    'http://www.weco.io',
    'https://www.weco.io',
    'http://weco.io',
    'https://weco.io',
  ];
  const { origin } = req.headers;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Authorization, Accept');

  next();
});

// AUTHENTICATION AND JWT MANAGEMENT
app.use(bearerToken());

const auth = require('./config/passport')();
app.use(auth.initialize());

// INITIALISE SOCKET.IO FOR EACH NAMESPACE
const server = require('http').Server(app);
const io = require('./config/io')(server);

io.notifications.on('connection', socket => {
  // Give the client their socket id so they can subscribe to real time notifications
  socket.emit('on_connect', { id: socket.id });

  socket.on('disconnect', () => {
    // Give the client their socket id so they can unsubscribe from real time notifications
    socket.emit('on_disconnect', { id: socket.id });
  });
});

// THE API ROUTES
const apiRouter = require('./routers/router')(app);
app.use('/', apiRouter);

// SERVE THE DOCS ON THE BASE ROUTE
app.use('/docs', express.static(`${__dirname}/docs`));

// START THE SERVER
server.listen(port);

clearConsole();
console.log(`🎩 Magic happens on port ${port}!`);

// export app for testing
module.exports = server;
