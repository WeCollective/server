// INITIALISE SOCKET.IO FOR EACH NAMESPACE
const fs = require('fs');
const https = require('https');
const reqlib = require('app-root-path').require;
const app = reqlib('/');
const clearConsole = reqlib('utils/clear-console');

const env = process.env.NODE_ENV;
const port = process.env.PORT || 8080;
const isLocal = env === 'local';
let server;

// Mock SSL in local environment.
if (isLocal) {
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
  const { id } = socket;
  // Give the client their socket id so they can subscribe to real time notifications
  socket.emit('on_connect', { id });

  socket.on('disconnect', () => {
    // Unsubscribe from real time notifications.
    socket.emit('on_disconnect', { id });
  });
});







clearConsole();
console.log(`✅ Server running at http${isLocal ? 's' : ''}://localhost:${port}/`);

module.exports = server;
