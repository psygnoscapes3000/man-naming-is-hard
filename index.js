const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(8013);

app.use('/', express.static('.'));

io.on('connection', (socket) => {
  console.log('connected');

  socket.emit('init', {});

  socket.on('action', (action) => {
    console.log('action', action);
    socket.emit('action_ack', action);
  });
});
