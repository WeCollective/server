/*
  Copyright (c) 2016 WE COLLECTIVE

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/
'use strict';

// REQUIRE MODULES
require('dotenv').config();                       // load any environment variables from the .env file

const express    = require('express');              // call express
const app        = express();                       // define our app using express
const helmet     = require('helmet');               // protect against common web vulnerabilities
const bodyParser = require('body-parser');          // reading request bodies
const cookieParser  = require('cookie-parser');     // reading cookies
let   passport      = require('passport');          // authentication
const session       = require('express-session');   // session middleware
const DynamoDBStore = require('connect-dynamodb')({ session });// dynamodb session store
const db = require('./config/database.js');         // database config vars

// DISABLE LOGGING IF IN TEST MODE
if ('test' === process.env.NODE_ENV) {
  console.error = function () {};
}

// SET ENVIRONMENT AND PORT
const env  = process.env.NODE_ENV || 'development';
const port = process.env.PORT || 8080;

// MIDDLEWARE
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// REDIRECT TRAFFIC ON HTTP TO HTTPS
if ('production' === process.env.NODE_ENV) {
  app.use( (req, res, next) => {
    if (!req.secure && 'https' !== req.get('X-Forwarded-Proto')) {
      res.redirect(`https://${req.get('Host') + req.url}`);
    }
    else {
      next();
    }
  });
}

// CROSS ORIGIN RESOURCE SHARING
app.use( (req, res, next) => {
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
    'https://weco.io'
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.indexOf(origin) !== -1) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Authorization, Accept');
  
  next();
});

// AUTHENTICATION AND SESSION MANAGEMENT
const options = {
  table: db.Table.Sessions,
  AWSConfigJSON: {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API
    },
    logger: 'development' === process.env.NODE_ENV ? process.stdout : undefined,
    region: 'eu-west-1',
    sslEnabled: true
  },
  reapInterval: 600000  // clean up expired sessions every 10 mins
};

app.use(session({
  store: new DynamoDBStore(options),
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET,
  resave: true
}));
passport = require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// INITIALISE SOCKET.IO FOR EACH NAMESPACE
const server = require('http').Server(app);
const io = require('./config/io.js')(server);

io.notifications.on('connection', socket => {
  // Give the client their socket id so they can subscribe to real time notifications
  socket.emit('on_connect', { id: socket.id });

  socket.on('disconnect', () => {
    // Give the client their socket id so they can unsubscribe from real time notifications
    socket.emit('on_disconnect', { id: socket.id });
  });
});

// THE API ROUTES
const apiRouter = require('./routers/router.js')(app, passport);
app.use('/', apiRouter);

// SERVE THE DOCS ON THE BASE ROUTE
app.use('/docs', express.static(__dirname + '/docs'));

// START THE SERVER
server.listen(port);
console.log(`Magic happens on port  ${port}`);

// export app for testing
module.exports = server;