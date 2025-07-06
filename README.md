# Wargame API

A simple turn-based wargame API in Node.js. Two sides (Red & Blue), five units per side, fighting on a 10x10 grid. Players issue **standing orders** to their units via API—no per-turn micromanagement. The game proceeds automatically, advancing one turn per second.

## Features

* **10x10 grid**
* **5 units per side**, each with 10 HP
* **Cities**: Two per side; lose all and you lose the game
* **Standing orders**: Tell your units to move in a direction or toward a target
* **Automatic turns**: The game updates every second

## Running the Server

```bash
npm install express
GITHUB_TOKEN=$(gh auth token) node wargame.js
```

Server runs on [http://localhost:3000](http://localhost:3000)

Of course you can use any GitHub token (though if it's a PAT it needs models: read)

## API

### Issue a Move Order

**POST** `/order`

```json
{
  "unit": "B1",
  "action": "move",
  "direction": "s",
  "tiles": 3
}
```

Or:

```json
{
  "unit": "B2",
  "action": "move_to",
  "target": { "x": 5, "y": 5 }
}
```

### Get Current Game State

**GET** `/state`

Returns the full current game state (all units, cities, winner if any, turn number).

### Reset the Game

**POST** `/reset`

Resets to the initial state.

## Notes

* **Unit IDs** are `"B0"`–`"B4"` for Blue, `"R0"`–`"R4"` for Red.
* A unit can only have one standing order at a time.
* Collisions: When units land on the same tile, all but one take HP loss (randomly resolved).

---

Let me know if you want a usage example or want to clarify any rules!
