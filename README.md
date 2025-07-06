# Generals

A simple turn-based wargame in Node.js. Two sides (Red & Blue), five units per side, fighting on a 20x20 grid. The interesting thing is that players issue orders to their units via AI - no direct control. The game proceeds automatically, advancing one turn per second.

This is inspired by that one HN post about realistic communication in wargames, and by the last part of Ender's Game where they shift from per-unit command to giving only strategic orders.

I think this could be a pretty compelling genre. The skill of issuing sensible orders and of crafting useful system prompts both seem interesting.

## Usage

```bash
npm install express
GITHUB_TOKEN=$(gh auth token) node wargame.js
```

Server runs on [http://localhost:3000](http://localhost:3000)

Uses GitHub Models for free inference, so you can use any GitHub token (though if it's a PAT it needs models: read)

## Design

The server is a simple API that handles the actual game logic. It has a /state endpoint and an /order endpoint (and proxies LLM inference, in case I ever want to deploy this with a real secret).

The client is a HTML page with a bunch of JS on it to poll /state twice a second and send /order based on the LLM response.

Right now you fight against bots that aren't LLM-powered. It would be cool to fight against another player who's also typing instructions.
