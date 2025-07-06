const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static('.'));

// CONSTANTS
const GRID_SIZE = 20;
const UNITS_PER_SIDE = 5;
const INITIAL_HP = 10;
const TICK_INTERVAL = 1000; // ms

// Utilities
function rollDice() {
    return Math.ceil(Math.random() * 6); // 1-6
}

// Directions
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// Set up the initial game state
function initialGameState() {
    // Blue starts at top, Red at bottom
    let units = [];
    for (let i = 0; i < UNITS_PER_SIDE; ++i) {
        units.push({
            id: 'B' + i,
            side: 'blue',
            x: i * 2,
            y: 0,
            hp: INITIAL_HP,
            orderQueue: []
        });
        units.push({
            id: 'R' + i,
            side: 'red',
            x: i * 2,
            y: GRID_SIZE - 1,
            hp: INITIAL_HP,
            orderQueue: []
        });
    }
    
    // More centered cities
    let cities = [
        { side: 'blue', x: 7, y: 1 }, { side: 'blue', x: 12, y: 1 },
        { side: 'red', x: 7, y: GRID_SIZE - 2 }, { side: 'red', x: 12, y: GRID_SIZE - 2 }
    ];
    
    // Mountain range - jagged, left-biased, with gaps
    let mountains = [];
    
    // Segment 1: A jagged line from (2,9) to (8,9)
    for (let x = 2; x <= 8; x++) {
        if (x % 3 === 0) mountains.push({ x, y: 8 }); // Jagged peak
        if (x % 2 === 0) mountains.push({ x, y: 10 }); // Jagged valley
    }

    // Segment 2: A thicker cluster around x=4
    mountains.push({ x: 4, y: 8 });
    mountains.push({ x: 4, y: 11 });
    mountains.push({ x: 5, y: 11 });
    
    return { units, cities, mountains, winner: null, turn: 0, events: [] };
}

let state = initialGameState();

// === GAME LOGIC ===

function isMountain(x, y) {
    return state.mountains.some(mountain => mountain.x === x && mountain.y === y);
}

function moveUnit(unit, order) {
    if (!order || unit.hp <= 0) return;
    if (order.action === "move") {
        let [dx, dy] = DIRS[order.direction];
        let nextX = unit.x + dx;
        let nextY = unit.y + dy;
        if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
            // Check if position is a mountain
            if (isMountain(nextX, nextY)) {
                // Can't move through mountains, but still consume the order
            } else {
                // Check if position is occupied
                const occupyingUnit = state.units.find(u => u.hp > 0 && u !== unit && u.x === nextX && u.y === nextY);
                if (occupyingUnit) {
                    // If enemy unit, do combat but don't move
                    if (occupyingUnit.side !== unit.side) {
                        // Both units take damage
                        let loss1 = rollDice();
                        let loss2 = rollDice();
                        let oldHp1 = unit.hp;
                        let oldHp2 = occupyingUnit.hp;
                        unit.hp = Math.max(0, unit.hp - loss1);
                        occupyingUnit.hp = Math.max(0, occupyingUnit.hp - loss2);
                        
                        // Track damage events
                        if (oldHp1 > unit.hp) {
                            state.events.push({ type: 'damage', x: unit.x, y: unit.y, unit: unit.id });
                        }
                        if (oldHp2 > occupyingUnit.hp) {
                            state.events.push({ type: 'damage', x: occupyingUnit.x, y: occupyingUnit.y, unit: occupyingUnit.id });
                        }
                        
                        // Track kill events
                        if (unit.hp === 0) {
                            state.events.push({ type: 'kill', x: unit.x, y: unit.y, unit: unit.id });
                        }
                        if (occupyingUnit.hp === 0) {
                            state.events.push({ type: 'kill', x: occupyingUnit.x, y: occupyingUnit.y, unit: occupyingUnit.id });
                        }
                    }
                    // Don't move, but still consume the order
                } else {
                    // Position is free, move there
                    unit.x = nextX;
                    unit.y = nextY;
                }
            }
        }
        order.tiles -= 1;
        if (order.tiles <= 0) {
            // Order completed, remove from queue
            unit.orderQueue.shift();
        }
    } else if (order.action === "move_to") {
        let dx = Math.sign(order.target.x - unit.x);
        let dy = Math.sign(order.target.y - unit.y);
        if (dx !== 0 || dy !== 0) {
            if (dx !== 0 && dy !== 0 && Math.random() < 0.5) dx = 0; // Only move one axis per turn
            let nextX = unit.x + dx;
            let nextY = unit.y + dy;
            if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
                // Check if position is a mountain
                if (isMountain(nextX, nextY)) {
                    // Can't move through mountains, clear the order
                    unit.orderQueue.shift();
                } else {
                    // Check if position is occupied
                    const occupyingUnit = state.units.find(u => u.hp > 0 && u !== unit && u.x === nextX && u.y === nextY);
                    if (occupyingUnit) {
                        // If enemy unit, do combat but don't move
                        if (occupyingUnit.side !== unit.side) {
                            // Both units take damage
                            let loss1 = rollDice();
                            let loss2 = rollDice();
                            let oldHp1 = unit.hp;
                            let oldHp2 = occupyingUnit.hp;
                            unit.hp = Math.max(0, unit.hp - loss1);
                            occupyingUnit.hp = Math.max(0, occupyingUnit.hp - loss2);
                            
                            // Track damage events
                            if (oldHp1 > unit.hp) {
                                state.events.push({ type: 'damage', x: unit.x, y: unit.y, unit: unit.id });
                            }
                            if (oldHp2 > occupyingUnit.hp) {
                                state.events.push({ type: 'damage', x: occupyingUnit.x, y: occupyingUnit.y, unit: occupyingUnit.id });
                            }
                            
                            // Track kill events
                            if (unit.hp === 0) {
                                state.events.push({ type: 'kill', x: unit.x, y: unit.y, unit: unit.id });
                            }
                            if (occupyingUnit.hp === 0) {
                                state.events.push({ type: 'kill', x: occupyingUnit.x, y: occupyingUnit.y, unit: occupyingUnit.id });
                            }
                        }
                        // Don't move, but continue trying to reach target
                    } else {
                        // Position is free, move there
                        unit.x = nextX;
                        unit.y = nextY;
                    }
                }
            } else {
                // Hit edge of map, clear the order
                unit.orderQueue.shift();
            }
        }
        if (unit.x === order.target.x && unit.y === order.target.y) {
            // Order completed, remove from queue
            unit.orderQueue.shift();
        }
    }
}

function processTurn() {
    if (state.winner) return;
    // 1. Move all units according to standing orders
    for (let unit of state.units) {
        if (unit.hp > 0 && unit.orderQueue.length > 0) {
            moveUnit(unit, unit.orderQueue[0]);
        }
    }
    // 2. City capture (no collision handling needed since units can't stack)
    for (let city of state.cities) {
        for (let unit of state.units.filter(u => u.hp > 0 && u.x === city.x && u.y === city.y && u.side !== city.side)) {
            // City captured - changes to the capturing unit's side
            state.events.push({ type: 'capture', x: city.x, y: city.y, city: city });
            city.side = unit.side;
        }
    }
    // 3. Check win condition
    let blueCities = state.cities.filter(c => c.side === 'blue').length;
    let redCities = state.cities.filter(c => c.side === 'red').length;
    if (blueCities === 0) state.winner = 'red';
    if (redCities === 0) state.winner = 'blue';
    state.turn += 1;
    
    // Clear events after one turn
    setTimeout(() => {
        state.events = [];
    }, TICK_INTERVAL);
}

// === API ENDPOINTS ===

/**
 * Order format:
 * {
 *   unit: "B1",
 *   action: "move",
 *   direction: "s",
 *   tiles: 3
 * }
 * OR
 * {
 *   unit: "B2",
 *   action: "move_to",
 *   target: {x: 5, y: 5}
 * }
 */
app.post('/order', (req, res) => {
    const { unit, action, ...args } = req.body;
    let u = state.units.find(u => u.id === unit && u.hp > 0);
    if (!u) return res.status(400).json({ error: 'Unit not found or dead' });
    
    let newOrder = null;
    if (action === "move" && args.direction && args.tiles > 0 && DIRS[args.direction]) {
        newOrder = { action, direction: args.direction, tiles: args.tiles };
    } else if (action === "move_to" && args.target && typeof args.target.x === "number" && typeof args.target.y === "number") {
        newOrder = { action, target: args.target };
    } else {
        return res.status(400).json({ error: 'Invalid order' });
    }
    
    // Add order to queue instead of replacing
    u.orderQueue.push(newOrder);
    res.json({ ok: true, unit: u, queueLength: u.orderQueue.length });
});

// Get current game state
app.get('/state', (req, res) => {
    res.json(state);
});

// Reset for dev/testing
app.post('/reset', (req, res) => {
    state = initialGameState();
    res.json({ ok: true });
});

// OpenAI Chat proxy with game tools
app.post('/chat', async (req, res) => {
    try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return res.status(500).json({ error: 'GITHUB_TOKEN environment variable not set' });
        }

        // Helper functions for prompt generation
        function renderAscii(gameState) {
            const GRID_SIZE = 20;
            let grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill('.'));

            // Place mountains
            if (gameState.mountains) {
                for (let mountain of gameState.mountains) {
                    grid[mountain.y][mountain.x] = '^';
                }
            }
            
            // Place cities
            for (let city of gameState.cities) {
                const symbol = city.side === 'blue' ? 'C' : 'c';
                grid[city.y][city.x] = symbol;
            }
            
            // Place units (units override cities on display)
            for (let unit of gameState.units.filter(u => u.hp > 0)) {
                let symbol = unit.side === 'blue' ? unit.id : unit.id.toLowerCase();
                grid[unit.y][unit.x] = symbol;
            }
            
            // Add row numbers and return formatted string
            return grid.map((row, i) => 
                `${i.toString().padStart(2, ' ')} ${row.join('')}`
            ).join('\n') + '\n   ' + Array.from({length: GRID_SIZE}, (_, i) => i % 10).join('');
        }

        function buildHelpers(gameState) {
            const blueUnits = gameState.units.filter(u => u.side === 'blue' && u.hp > 0);
            const redUnits = gameState.units.filter(u => u.side === 'red' && u.hp > 0);
            const blueCities = gameState.cities.filter(c => c.side === 'blue');
            const redCities = gameState.cities.filter(c => c.side === 'red');

            return {
                blueUnits: blueUnits.map(u => `${u.id}:(${u.x},${u.y}) HP:${u.hp}`).join(', '),
                redUnits: redUnits.map(u => `${u.id}:(${u.x},${u.y}) HP:${u.hp}`).join(', '),
                blueCities: blueCities.map(c => `(${c.x},${c.y})`).join(', '),
                redCities: redCities.map(c => `(${c.x},${c.y})`).join(', '),
                mountains: gameState.mountains.map(m => `(${m.x},${m.y})`).join(', ')
            };
        }

        // Get current game state for the request
        const currentGameState = req.body.gameState || state;
        const asciiMap = renderAscii(currentGameState);
        const helpers = buildHelpers(currentGameState);

        const systemMsg = `You are the AI commander of the blue team (coordinate system: (0,0) top-left).

MAP
${asciiMap}

ENTITY COORDINATES
Blue units: ${helpers.blueUnits}
Red units: ${helpers.redUnits}
Blue cities: ${helpers.blueCities}
Red cities: ${helpers.redCities}
Mountains: ${helpers.mountains}

RULES
- Units move N/E/S/W one tile per turn; mountains (^) block movement.
- Entering an enemy city captures it. Entering an enemy unit's tile damages both.
- Blue wins by capturing all red cities or eliminating all red units.
- You can queue multiple orders per unit for sequential execution.

THINKING
Silently think step-by-step. **Do not send your thoughts.**
When ready, call the tool "issue_orders" **once** with an array of orders.`;

        // Define single tool for issuing orders
        const tools = [
            {
                type: "function",
                function: {
                    name: "issue_orders",
                    description: "Issue movement orders for blue units",
                    parameters: {
                        type: "object",
                        properties: {
                            orders: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        unit: {
                                            type: "string",
                                            description: "Unit ID (B0-B4)",
                                            enum: ["B0", "B1", "B2", "B3", "B4"]
                                        },
                                        action: {
                                            type: "string",
                                            description: "Type of movement",
                                            enum: ["move", "move_to"]
                                        },
                                        direction: {
                                            type: "string",
                                            description: "Direction to move (for 'move' action)",
                                            enum: ["n", "s", "e", "w"]
                                        },
                                        tiles: {
                                            type: "integer",
                                            description: "Number of tiles to move (for 'move' action)",
                                            minimum: 1,
                                            maximum: 20
                                        },
                                        target: {
                                            type: "object",
                                            description: "Target coordinates (for 'move_to' action)",
                                            properties: {
                                                x: { type: "integer", minimum: 0, maximum: 19 },
                                                y: { type: "integer", minimum: 0, maximum: 19 }
                                            },
                                            required: ["x", "y"]
                                        }
                                    },
                                    required: ["unit", "action"]
                                }
                            }
                        },
                        required: ["orders"]
                    }
                }
            }
        ];

        // Prepare the request body with the new system message
        const requestBody = {
            model: "openai/gpt-4.1",
            messages: [
                { role: "system", content: systemMsg },
                ...(req.body.messages || []).filter(m => m.role !== "system")
            ],
            tools: tools,
            tool_choice: "auto"
        };

        // Forward request to GitHub Models
        const response = await fetch('https://models.github.ai/inference/chat/completions', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub Models API error:', errorText);
            return res.status(response.status).json({ 
                error: 'GitHub Models API error', 
                details: errorText 
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Chat proxy error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// === START GAME LOOP ===
setInterval(processTurn, TICK_INTERVAL);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Wargame API running on http://localhost:${PORT}`);
});
