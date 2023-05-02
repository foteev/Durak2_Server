import { Socket } from "socket.io";
import { gameStore, gameStoreWithHistory } from "../store/gameStore.mjs";
import { TypeGameStatus, TypePlayerRole, TypePlayerStatus, TypeAction } from "components/types/types.mjs";
import { giveCards, makePlayerMove, createDeck, undoGameStore, playerPass, clearHands, sortPlayerCards, endGame, exitPlayer } from "./utils.js";
import { subscribe } from "valtio";
import { roomNamespace, io } from "../../index.js";
import { rmSync } from "fs";

export const SocketManager = (socket: any) => {
  const players = gameStore.players
  let i: any | undefined = undefined;
  clearTimeout(i)
  console.log('clear timeout')

  socket.on('connect', () => {
    
    socket.emit('game status', {roomId: gameStore.id, player1: players[0].playerName, player2: players[1].playerName, status: gameStore.gameStatus})
  })

  socket.on('player name & socket.id', (message: {name: string, socketId: string}) => {
    if (players[0].playerStatus === TypePlayerStatus.Offline) {
      console.log('player 0 enter')
      players[0].playerName = message.name;
      players[0].socketId = message.socketId;
      players[0].playerStatus = TypePlayerStatus.InGame
      players[0].playerRole = TypePlayerRole.Attacker
      players[1].playerRole = TypePlayerRole.Defender
      gameStore.gameStatus = TypeGameStatus.DrawingCards;
      gameStore.hostId = message.name;
      giveCards();
      players[0].playerRole = TypePlayerRole.Defender
      players[1].playerRole = TypePlayerRole.Attacker
      players[0].playerStatus = TypePlayerStatus.InGame
      if (players[1].playerStatus === TypePlayerStatus.Offline) {
        gameStore.gameStatus = TypeGameStatus.WaitingForPlayers;
      } else {
        gameStore.gameStatus = TypeGameStatus.GameInProgress;
      }
      socket.emit('player 0 enter', JSON.stringify(gameStore));
    }
    else if (players[1].playerStatus === TypePlayerStatus.Offline) {
      console.log('player 1 enter')
      players[1].playerName = message.name;
      players[1].socketId = message.socketId;
      players[1].playerStatus = TypePlayerStatus.InGame
        gameStore.gameStatus = TypeGameStatus.GameInProgress;
      socket.emit('player 1 enter', JSON.stringify(gameStore));
    }
    else if (players[0].playerName === message.name) {
      players[0].socketId = message.socketId;
      console.log('return 0')
    }
    else if (players[1].playerName === message.name) {
      players[1].socketId = message.socketId;
      console.log('return 1')
      socket.emit('player 1 enter', JSON.stringify(gameStore));
    }
    else {
      socket.emit('error', 'The room is full');
    }
    clearTimeout(i);
    console.log('clear timeout')
  })

  socket.on('player move', (message: {playerIndex: number, card: string}) => {
    clearTimeout(i);
    console.log('clear timeout')
    makePlayerMove(message.playerIndex, message.card);
  })

  socket.on('undo', (message: { playerIndex: number }) => {
    undoGameStore(message.playerIndex);
    clearTimeout(i);
    console.log('clear timeout')
  })

  socket.on('pass', (playerIndex: number) => {
    playerPass(playerIndex);
    clearTimeout(i);
    console.log('clear timeout')
  })

  socket.on('reset', () => {
    clearHands(2);
    clearTimeout(i);
    console.log('clear timeout')
  })

  socket.on('sort', (message: any) => {
    sortPlayerCards(message.playerIndex, message.type)
    clearTimeout(i);
    console.log('clear timeout')
  })

  socket.on('end game', (playerIndex: number) => {
    socket.to(players[playerIndex].socketId).emit('end game loser');
    socket.to(playerIndex === 0 ? players[1].socketId : players[0].socketId).emit('end game winner');
    endGame(playerIndex);
    socket.emit('replay')
    clearTimeout(i);
    console.log('clear timeout')
  })

  socket.on('exit', async (playerIndex: number) => {
    exitPlayer(playerIndex);
    console.log(players[playerIndex])
    socket.emit(`exit ${players[playerIndex].playerName}`);
    console.log(`exit ${players[playerIndex].playerName}`)
    clearTimeout(i);
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      if (socket.id === players[playerIndex].socketId) {
        socket.disconnect(true);
      }
    }
    console.log('clear timeout')
  })

  subscribe(gameStore, () => {
    console.log('store emitted', gameStore.gameStatus, gameStore.players[0].playerName, gameStore.players[0].playerStatus, gameStore.players[1].playerName, gameStore.players[1].playerStatus)
    socket.to(players[0].socketId).emit('store update', JSON.stringify(gameStore));
    socket.to(players[1].socketId).emit('store update', JSON.stringify(gameStore));
    
  })

  subscribe(gameStore.players, () => {
    if (gameStore.gameStatus === TypeGameStatus.GameInProgress 
      && gameStore.lastAction !== TypeAction.Undefined
      && gameStore.deckCards.length === 0) {
      gameStore.players.forEach((player, playerIndex) => {
        if (player.cards.length === 0) {
          const otherPlayerIndex = playerIndex === 0 ? 1: 0
          endGame(playerIndex);
          socket.to(players[playerIndex].socketId).emit('end game winner');
          socket.to(players[otherPlayerIndex].socketId).emit('end game loser');

        }
      })
    }
  })

  subscribe(gameStore, () => {
    if (gameStore.gameStatus === TypeGameStatus.GameInProgress) {

      if ( i !== undefined ) {
        clearTimeout(i);
        console.log('clear timeout')
      }

      i = setTimeout(async () => {
        exitPlayer(0);
        exitPlayer(1);
        const sockets = await io.fetchSockets();
        for (const socket of sockets) {
          socket.emit(`exit 0 1`);
          socket.disconnect(true);
        }
        console.log(`exit 0 1`)
      }, 60000)
      console.log('setTimeout')
    }
  })
}