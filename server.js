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
var express    = require("express");              // call express
var app        = express();                       // define our app using express
var helmet = require('helmet');                   // protect against common web vulnerabilities
var bodyParser = require("body-parser");          // reading request bodies
var cookieParser = require('cookie-parser');      // reading cookies
var passport = require('passport');               // authentication
var session      = require('express-session');    // session middleware
var DynamoDBStore = require('connect-dynamodb')({ // dynamodb session store
  session: session
});
var db = require("./config/database.js");         // database config vars

// DISABLE LOGGING IF IN TEST MODE
if (process.env.NODE_ENV == 'test') {
  console.error = function () {};
}

// SET ENVIRONMENT AND PORT
var env = (process.env.NODE_ENV || "development");
var port = process.env.PORT || 8080;

// MIDDLEWARE
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// REDIRECT TRAFFIC ON HTTP TO HTTPS
if(process.env.NODE_ENV === 'production') {
  app.use(function(req, res, next) {
    if((!req.secure) && (req.get('X-Forwarded-Proto') !== 'https')) {
      res.redirect('https://' + req.get('Host') + req.url);
    } else {
      next();
    }
  });
}

// CROSS ORIGIN RESOURCE SHARING
app.use(function(req, res, next) {
  var allowedOrigins = ['http://localhost:8081', 'http://webapp-dev.eu9ntpt33z.eu-west-1.elasticbeanstalk.com', 'http://webapp-prod.eu-west-1.elasticbeanstalk.com', 'http://www.weco.io', 'https://www.weco.io', 'http://weco.io', 'https://weco.io'];
  var origin = req.headers.origin;
  if(allowedOrigins.indexOf(origin) > -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Authorization, Accept");
  next();
});

// AUTHENTICATION AND SESSION MANAGEMENT
var options = {
  table: db.Table.Sessions,
  AWSConfigJSON: {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API
    },
    region: 'eu-west-1',
    sslEnabled: true,
    logger: process.env.NODE_ENV == "test" ? undefined : process.stdout
  },
  reapInterval: 600000  // clean up expired sessions every 10 mins
};

app.use(session({
  store: new DynamoDBStore(options),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true
  }
}));
passport = require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// INITIALISE SOCKET.IO FOR EACH NAMESPACE
var server = require('http').Server(app);
var io = require('./config/io.js')(server);

io.notifications.on('connection', function(socket) {
  // Give the client their socket id so they can subscribe to real time notifications
  socket.emit('on_connect', { id: socket.id });

  socket.on('disconnect', function() {
    // Give the client their socket id so they can unsubscribe from real time notifications
    socket.emit('on_disconnect', { id: socket.id });
  });
});

// THE API ROUTES
var apiRouter = require('./routers/router.js')(app, passport);
app.use('/', apiRouter);

// SERVE THE DOCS ON THE BASE ROUTE
app.use('/docs', express.static(__dirname + '/docs'));

// START THE SERVER
server.listen(port);
console.log('Magic happens on port ' + port);

// export app for testing
module.exports = server;
