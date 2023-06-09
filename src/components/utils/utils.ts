import { initialObj, gameStore, gameStoreWithHistory } from '../store/gameStore.mjs';
import { subscribe, snapshot } from "valtio";
import {
  TypeCard,
  TypePlacedCard,
  TypeGameStatus,
  TypePlayerRole,
  TypePlayer,
  TypeCardRank,
  TypeCardSuit,
  TypeGameStore,
  TypeAction,
  TypePlayerStatus
} from "../types/types.mjs";
// import { MaskedFrame } from "@pixi/ui";
import _ from "lodash";

const MAX_CARDS_IN_HAND = 6;

export const startGame = (playerIndex: number) => {
  gameStore.gameStatus = TypeGameStatus.DrawingCards;
  // giveCards(playerIndex);
}

export const createDeck = () => {
  const cards:Array<TypeCard> = [];
  let trump: TypeCard

  const ranks: TypeCardRank[] = [
    TypeCardRank.RANK_6,
    TypeCardRank.RANK_7,
    TypeCardRank.RANK_8,
    TypeCardRank.RANK_9,
    TypeCardRank.RANK_10,
    TypeCardRank.RANK_J,
    TypeCardRank.RANK_Q,
    TypeCardRank.RANK_K,
    TypeCardRank.RANK_A,
  ];

  const suits: TypeCardSuit[] = [
    TypeCardSuit.Clubs, // ♣
    TypeCardSuit.Diamonds, // ♠
    TypeCardSuit.Hearts, // ♥
    TypeCardSuit.Spades, // ♦
  ];

  for (const suit of suits) {
    for (const rank of ranks) {
      const name = suit.slice(0, 1).concat(rank.toString())
      const card = { name: name, rank: rank, suit: suit, isTrump: false } as TypeCard;
      cards.push(card);
    }
  }

  for (let i = cards.length - 1; i > 0; i -= 1) {
    const randomCardIdx = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[randomCardIdx]] = [cards[randomCardIdx], cards[i]];
  }

  trump = cards[cards.length - 1];

  for (const card of cards) {
    if (card.suit === trump.suit) {
      card.isTrump = true;
    }
  }

  gameStore.deckCards = cards;
}


export const giveCards = () => {
  const attacker = gameStore.players.filter(player => player.playerRole === TypePlayerRole.Attacker)[0];
  const defender = gameStore.players.filter(player => player.playerRole === TypePlayerRole.Defender)[0];
  const length1 = attacker.cards.length;
  const length2 = defender.cards.length;
  const minHand = Math.min(length1, length2)
  for (let i = 0; i < MAX_CARDS_IN_HAND - minHand; i++) {
    if (gameStore.deckCards[0]) {
      if (length1 < MAX_CARDS_IN_HAND)
        attacker.cards.push(gameStore.deckCards.shift()!);
    }
    if (gameStore.deckCards[0]) {
      if (length2 < MAX_CARDS_IN_HAND)
        defender.cards.push(gameStore.deckCards.shift()!)
    }
  }
}

export const makePlayerMove = (playerIndex: number, cardName: string) => {
  const cardIndex: number = gameStore.players[playerIndex].cards.indexOf(gameStore.players[playerIndex].cards.filter(card => card.name === cardName as string)[0]);
  const card: TypeCard = gameStore.players[playerIndex].cards.splice(cardIndex, 1)[0] as TypeCard;
  if (gameStore.players[playerIndex].playerRole === TypePlayerRole.Attacker) {
    makeAttackingMove(playerIndex, card);
  } else if (gameStore.players[playerIndex].playerRole === TypePlayerRole.Defender) {
    makeDefendingMove(playerIndex, card);
  }
}

const makeAttackingMove = (playerIndex: number, card: TypeCard) => {
  const placedCard = { attacker:card } as TypePlacedCard
  gameStore.placedCards.push(placedCard);
  gameStore.lastAction = TypeAction.AttackerMoveCard
}

const makeDefendingMove = (playerIndex: number, card: TypeCard) => {
  const placedLength = gameStore.placedCards.length;
  if (gameStore.placedCards[placedLength - 1]) {
    const placedCardIndex = gameStore.placedCards.reverse().findIndex(placedCard =>
      typeof(placedCard.defender === null)
    )
    gameStore.placedCards[placedCardIndex].defender = card;
    gameStore.lastAction = TypeAction.DefenderMoveCard
  }
}

export const undoGameStore = (playerIndex: number) => {

  //is not working: from valtio docs
  // gameStoreWithHistory.undo();

  //is working
  const lastSnapshot = gameStoreWithHistory.history.snapshots[gameStoreWithHistory.history.index- 1] as TypeGameStore;
  gameStore.players[0].cards = [...lastSnapshot.players[0].cards!];
  gameStore.players[1].cards = [...lastSnapshot.players[1].cards!];

  if (gameStore.placedCards) {
    gameStore.placedCards = lastSnapshot.placedCards;
  }
}

export const playerPass = (playerIndex: number) => {
  const player = gameStore.players[playerIndex];
  if (player.playerRole === TypePlayerRole.Attacker) {
    const otherPlayerIndex = playerIndex === 0 ? 1 : 0;
    player.playerRole = TypePlayerRole.Defender;
    gameStore.players[otherPlayerIndex].playerRole = TypePlayerRole.Attacker;
    gameStore.placedCards.forEach(placedCard => {
      gameStore.dealtCards.push(gameStore.placedCards.shift()!)
    })
    gameStore.lastAction = TypeAction.AttackerPass;
  }
  if (player.playerRole === TypePlayerRole.Defender) {
    gameStore.placedCards.forEach(card => {
      if (card.defender) {
        player.cards.push(card.defender);
      }
      if (card.attacker) {
        player.cards.push(card.attacker);
      }
    });
    gameStore.placedCards = [];
    gameStore.lastAction = TypeAction.DefenderTakesCards;
  }
  giveCards();
}

export const clearHands = (historyIndex: number) => {
  const startSnapshot = gameStoreWithHistory.history.snapshots[historyIndex] as TypeGameStore;
  const player1 = gameStore.players[0];
  const player2 = gameStore.players[1];
  const snap1 = startSnapshot.players[0];
  const snap2 = startSnapshot.players[1];
  gameStore.deckCards = [...startSnapshot.deckCards!];
  player1.cards = [...snap1.cards!];
  player2.cards = [...snap2.cards!];
  player1.playerRole = snap1.playerRole;
  player2.playerRole = snap2.playerRole;
  player1.playerStatus = TypePlayerStatus.InGame;
  player2.playerStatus = TypePlayerStatus.InGame;
  gameStore.gameStatus = startSnapshot.gameStatus;
  if (gameStore.placedCards) {
    gameStore.placedCards = [];
  }
  if (historyIndex === 0) {
    gameStore.deckCards = [];
    createDeck();
    giveCards();
  }
}

export const sortPlayerCards = (playerIndex: number, type: string) => {
  switch (type) {
    case 'byRank':
      gameStore.players[playerIndex].cards.sort((a,b) => Number(a.rank) - Number(b.rank));
      break;
    case 'bySuit':
      gameStore.players[playerIndex].cards
        .sort((a,b) => Number(a.rank) - Number(b.rank))
        .sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
      break;
    default:
      break;
  }
}

export const endGame = (playerIndex: number) => {
  gameStore.gameStatus = TypeGameStatus.GameIsOver;
  const player1 = gameStore.players[playerIndex];
  const otherPlayerIndex = playerIndex === 0 ? 1 : 0;
  const player2 = gameStore.players[otherPlayerIndex];
  if (player1.cards.length !== 0) {
    player1.playerStatus = TypePlayerStatus.YouLoser;
    player2.playerStatus = TypePlayerStatus.YouWinner;
  } else {
    player1.playerStatus = TypePlayerStatus.YouWinner;
    player2.playerStatus = TypePlayerStatus.YouLoser;
  }
  setTimeout(() => {
    clearHands(0);
    gameStore.gameStatus = TypeGameStatus.GameInProgress;
  }, 4000);
}

export const resetStore = () => {

  //does not work https://valtio.pmnd.rs/docs/how-tos/how-to-reset-state
  // const resetObj = _.cloneDeep(initialObj)
  // Object.keys(resetObj).forEach((key) => {
  //   gameStoreWithHistory[key] = resetObj[key]
  // })
  ;
}

export const exitPlayer = (playerIndex: number) => {
  gameStore.gameStatus = TypeGameStatus.WaitingForPlayers;
  const player1 = gameStore.players[playerIndex];
  const otherPlayerIndex = playerIndex === 0 ? 1 : 0;
  const player2 = gameStore.players[otherPlayerIndex];
  const initial1 = initialObj.players[playerIndex]
  const initial2 = initialObj.players[otherPlayerIndex];
  player1.playerName = initial1.playerName;
  player1.socketId = initial1.socketId;
  player1.playerStatus = initial1.playerStatus
  player1.playerRole = initial1.playerRole
  player1.cards = [];
  player2.cards = [];
  player2.playerRole = initial2.playerRole;
  gameStore.placedCards = [];
  gameStore.deckCards = [];
  gameStore.dealtCards = [];
  createDeck();
  giveCards();
}