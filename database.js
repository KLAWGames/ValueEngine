const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'ledger.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    monthly_cost REAL NOT NULL,
    is_active INTEGER DEFAULT 1
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    acquisition_type TEXT NOT NULL, -- 'retail', 'subscription', 'free', 'f2p'
    subscription_id TEXT REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
    base_cost REAL DEFAULT 0.00,
    elo_rating INTEGER DEFAULT 1200,
    match_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS game_purchases (
    purchase_id TEXT PRIMARY KEY,
    game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    cost REAL NOT NULL,
    purchased_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS play_logs (
    log_id TEXT PRIMARY KEY,
    game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
    hours_played REAL NOT NULL,
    logged_date TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS qualitative_profiles (
    profile_id TEXT PRIMARY KEY,
    game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
    story INTEGER CHECK (story BETWEEN 0 AND 10),
    multiplayer INTEGER CHECK (multiplayer BETWEEN 0 AND 10),
    mechanics INTEGER CHECK (mechanics BETWEEN 0 AND 10),
    graphics INTEGER CHECK (graphics BETWEEN 0 AND 10),
    challenge INTEGER CHECK (challenge BETWEEN 0 AND 10),
    relaxation INTEGER CHECK (relaxation BETWEEN 0 AND 10),
    pacing INTEGER CHECK (pacing BETWEEN 0 AND 10)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pairwise_matches (
    match_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
    game_a_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
    game_b_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
    chosen_game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('Database initialized successfully with schemas.');

module.exports = db;
