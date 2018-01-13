// INITIALISE SOCKET.IO FOR EACH NAMESPACE
const fs = require('fs');
const https = require('https');
const reqlib = require('app-root-path').require;
// const Slack = require('slack-node');

const app = reqlib('/');
const clearConsole = reqlib('utils/clear-console');

const env = process.env.NODE_ENV;
const port = process.env.PORT || 8080;
let server;

// Mock SSL in local environment.
if (env === 'local') {
  const httpsOptions = {
    cert: fs.readFileSync('./config/ssl/local-cert.pem'),
    key: fs.readFileSync('./config/ssl/local-key.pem'),
    rejectUnauthorized: false,
    requestCert: false,
  };
  server = https.createServer(httpsOptions, app).listen(port);
}
else {
  server = app.listen(port);
}

const io = reqlib('config/io')(server);

io.notifications.on('connection', socket => {
  // Give the client their socket id so they can subscribe to real time notifications
  socket.emit('on_connect', { id: socket.id });

  socket.on('disconnect', () => {
    // Unsubscribe from real time notifications.
    socket.emit('on_disconnect', { id: socket.id });
  });
});

clearConsole();
console.log(`🎩 Magic happens on port ${port}!`);

module.exports = server;

/*
const webhookUri = 'https://hooks.slack.com/services/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';

const slack = new Slack();
slack.setWebhook(webhookUri);

slack.webhook({
  // channel: '#general',
  username: 'testbot',
  text: 'Hmmm.',
}, (err, res) => {
  console.log(err, res);
});
*/
