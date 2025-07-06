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
        mountains.push({ x, y: 9 });
        if (x % 3 === 0) mountains.push({ x, y: 8 }); // Jagged peak
        if (x % 2 === 0) mountains.push({ x, y: 10 }); // Jagged valley
    }

    // Segment 2: A thicker cluster around x=4
    mountains.push({ x: 4, y: 8 });
    mountains.push({ x: 4, y: 11 });
    mountains.push({ x: 5, y: 11 });

    // Segment 3: Another jagged line further right, from (12,10) to (17,10)
    for (let x = 12; x <= 17; x++) {
        mountains.push({ x, y: 10 });
        if (x % 2 !== 0) mountains.push({ x, y: 11 }); // Jagged valley
        if (x % 4 === 0) mountains.push({ x, y: 9 }); // Jagged peak
    }
    
    return { units, cities, mountains, winner: null, turn: 0 };
}

let state = initialGameState();

// === GAME LOGIC ===
function isPositionOccupied(x, y, excludeUnit) {
    return state.units.some(unit => 
        unit.hp > 0 && 
        unit !== excludeUnit && 
        unit.x === x && 
        unit.y === y
    );
}

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
                        unit.hp = Math.max(0, unit.hp - loss1);
                        occupyingUnit.hp = Math.max(0, occupyingUnit.hp - loss2);
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
                            unit.hp = Math.max(0, unit.hp - loss1);
                            occupyingUnit.hp = Math.max(0, occupyingUnit.hp - loss2);
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
    // 2. City capture/destruction (no collision handling needed since units can't stack)
    for (let city of state.cities.slice()) {
        for (let unit of state.units.filter(u => u.hp > 0 && u.x === city.x && u.y === city.y && u.side !== city.side)) {
            // City destroyed, unit dies
            state.cities = state.cities.filter(c => c !== city);
            unit.hp = 0;
        }
    }
    // 3. Check win condition
    let blueCities = state.cities.filter(c => c.side === 'blue').length;
    let redCities = state.cities.filter(c => c.side === 'red').length;
    if (blueCities === 0) state.winner = 'red';
    if (redCities === 0) state.winner = 'blue';
    state.turn += 1;
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

        // Define tools that match game moves
        const tools = [
            {
                type: "function",
                function: {
                    name: "move_unit_direction",
                    description: "Move a unit in a specific direction for a number of tiles",
                    parameters: {
                        type: "object",
                        properties: {
                            unit: {
                                type: "string",
                                description: "Unit ID (B0-B4 for Blue, R0-R4 for Red)",
                                enum: ["B0", "B1", "B2", "B3", "B4", "R0", "R1", "R2", "R3", "R4"]
                            },
                            direction: {
                                type: "string",
                                description: "Direction to move (n=north, s=south, e=east, w=west)",
                                enum: ["n", "s", "e", "w"]
                            },
                            tiles: {
                                type: "integer",
                                description: "Number of tiles to move (1-20)",
                                minimum: 1,
                                maximum: 20
                            }
                        },
                        required: ["unit", "direction", "tiles"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "move_unit_to_position",
                    description: "Move a unit to a specific coordinate position. The pathfinding is very basic and does not handle collisions. Use a series of move_unit_direction calls if you want to move around an object",
                    parameters: {
                        type: "object",
                        properties: {
                            unit: {
                                type: "string",
                                description: "Unit ID (B0-B4 for Blue, R0-R4 for Red)",
                                enum: ["B0", "B1", "B2", "B3", "B4", "R0", "R1", "R2", "R3", "R4"]
                            },
                            x: {
                                type: "integer",
                                description: "Target X coordinate (0-19)",
                                minimum: 0,
                                maximum: 19
                            },
                            y: {
                                type: "integer",
                                description: "Target Y coordinate (0-19)",
                                minimum: 0,
                                maximum: 19
                            }
                        },
                        required: ["unit", "x", "y"]
                    }
                }
            },
            // {
            //     type: "function",
            //     function: {
            //         name: "get_game_state",
            //         description: "Get the current game state including all units, cities, and turn information",
            //         parameters: {
            //             type: "object",
            //             properties: {},
            //             required: []
            //         }
            //     }
            // }
        ];

        // Prepare the request body with tools
        const requestBody = {
            model: "openai/gpt-4o",
            messages: req.body.messages || [],
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
