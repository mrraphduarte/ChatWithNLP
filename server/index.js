const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
const { NlpManager } = require('node-nlp');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');

const router = require('./router');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(router);

const manager = new NlpManager({ languages: ['pt'] });
// Adds the utterances and intents for the NLP
manager.addDocument('pt', 'Me fale sobre o Marcal.', 'greetings.gerente');
manager.addDocument('pt', 'Me fale sobre a Samantha', 'greetings.gerente1');
manager.addDocument('pt', 'Me fale sobre o Ricardo', 'greetings.gerente2');
manager.addDocument('pt', 'Me fale sobre o Raphael', 'greetings.programador');
manager.addDocument('pt', 'Me fale sobre o Vinicius', 'greetings.programador2');
manager.addDocument('pt', 'Me fale sobre o Chapolin', 'greetings.Chapolin');
manager.addDocument('pt', 'Me fale sobre o Bolsonaro', 'greetings.Bolsonaro');
manager.addDocument('pt', 'Preciso ir', 'greetings.adeus');
manager.addDocument('pt', 'Até mais', 'greetings.adeus');
manager.addDocument('pt', 'Obrigado', 'greetings.adeus');

// Train also the NLG
manager.addAnswer('pt', 'greetings.gerente', 'Gerente do time de sistemas e tecnologia da empresa Vermont Call Center');
manager.addAnswer('pt', 'greetings.gerente1', 'Gerente do time de operações Big da empresa Vermont Call Center');
manager.addAnswer('pt', 'greetings.gerente2', 'Gerente do time de operações Ontex da empresa Vermont Call Center');
manager.addAnswer('pt', 'greetings.programador', 'Programador na Vermont Call Center');
manager.addAnswer('pt', 'greetings.programador2', 'Programador/Analista na Vermont Call Center');
manager.addAnswer('pt', 'greetings.Chapolin', 'Personagem estrelado por Roberto Gómez Bolaños, a série parodiava os super-heróis estadunidenses, e fazia constantemente críticas sociais em relação à América Latina.');
manager.addAnswer('pt', 'greetings.Bolsonaro', 'Jair Messias Bolsonaro Presidente da republica, eleito em 2019');
manager.addAnswer('pt', 'greetings.adeus', 'Espero ter ajudado, Até mais!');

io.on('connect', (socket) => {
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if(error) return callback(error);

    socket.join(user.room);

    socket.emit('message', { user: 'Administrador', text: `${user.name}, Bem-Vindo a sala ${user.room}.`});
    socket.broadcast.to(user.room).emit('message', { user: 'Administrador', text: `${user.name} entrou na sala!` });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    let msg = "";

    // Train and save the model.
    (async() => {
      await manager.train();
      manager.save();
      const response = await manager.process('pt', message);

      msg = response.answer;
      if(response.answer == undefined){
        msg = "Desculpe não entendi, digite uma palavra específica."
      }

      io.to(user.room).emit('message', { user: user.name, text: message });

      socket.emit('message', { user: 'Administrador', text: msg});

    })();

    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if(user) {
      io.to(user.room).emit('message', { user: 'Administrador', text: `${user.name} saiu.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
    }
  })
});

server.listen(process.env.PORT || 5000, () => console.log(`Servidor Online.`));