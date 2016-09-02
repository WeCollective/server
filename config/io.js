var io;
var namespaces = {};

// initialise socket with the server object
function init(server) {
  io = require('socket.io')(server);
  namespaces = {
    notifications: io.of('/notifications'),
    messages: io.of('/messages')
  };
}

module.exports = function(server) {
  // if socket.io hasn't been initialised with the server object, init first
  if(!io) {
    if(!server) {
      throw 'Cannot initialise socket.io with empty server object!';
    }
    init(server);
  }
  return namespaces;
};
