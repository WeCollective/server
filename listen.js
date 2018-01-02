// INITIALISE SOCKET.IO FOR EACH NAMESPACE
const http = require('http');
const reqlib = require('app-root-path').require;

const app = reqlib('/');
const clearConsole = reqlib('utils/clear-console');

const port = process.env.PORT || 8080;
const server = http.Server(app);

const io = reqlib('config/io')(server);

io.notifications.on('connection', socket => {
  // Give the client their socket id so they can subscribe to real time notifications
  socket.emit('on_connect', { id: socket.id });

  socket.on('disconnect', () => {
    // Unsubscribe from real time notifications.
    socket.emit('on_disconnect', { id: socket.id });
  });
});

server.listen(port);

clearConsole();
console.log(`🎩 Magic happens on port ${port}!`);

module.exports = server;
