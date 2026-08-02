const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

const url = process.env.TURSO_DATABASE_URL || 'libsql://value-engine-klawgames.aws-us-west-2.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODU2ODE2NTgsImlkIjoiMDE5ZmMyZWItNjcwMS03MDgzLWEzMmItMmJmMDBiZTI5OWY5Iiwia2lkIjoiY3dNOU5xakFyMmFhYVZCaFd6MDNPQ05vR1JtTm9xZmNwZjVVZ3VCWV92USIsInJpZCI6ImY3NjM2OTU2LWIxYmItNDhlNC1hZmZkLTk4NDk2YjQ4NDc1MCJ9.mhSGS0tAbhgvYT7v1dXuJqikhIijD88ri8ovMwDs4YkxIMejWfW7BMikKlRSXmxWm_H3LyRC6ECDMRTXKbkVBQ';

const client = createClient({
  url,
  authToken
});

const initDb = async () => {
  if (!url) return;
  try {
    console.log('Connecting to Turso libSQL database and running migrations...');
    
    // Convert schemas from Postgres to SQLite
    const schemas = [
      `CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS subscriptions (
        subscription_id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        monthly_cost REAL NOT NULL,
        cost REAL,
        billing_cycle TEXT DEFAULT 'monthly',
        is_active BOOLEAN DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        acquisition_type TEXT NOT NULL,
        subscription_id TEXT REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
        base_cost REAL DEFAULT 0.00,
        elo_rating INTEGER DEFAULT 1200,
        match_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'playing',
        score_100 INTEGER NULL,
        recommend BOOLEAN NULL,
        unplayed BOOLEAN DEFAULT 0,
        overall_hours REAL DEFAULT 0.00,
        play_mode TEXT DEFAULT 'single',
        wont_play_again BOOLEAN DEFAULT 0,
        has_opinion BOOLEAN DEFAULT 1,
        linear_position INTEGER NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS game_purchases (
        purchase_id TEXT PRIMARY KEY,
        game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        cost REAL NOT NULL,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS play_logs (
        log_id TEXT PRIMARY KEY,
        game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        hours_played REAL NOT NULL,
        logged_date DATETIME NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS qualitative_profiles (
        profile_id TEXT PRIMARY KEY,
        game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        story INTEGER,
        multiplayer INTEGER,
        mechanics INTEGER,
        graphics INTEGER,
        challenge INTEGER,
        relaxation INTEGER,
        pacing INTEGER,
        engagement INTEGER,
        social INTEGER,
        stress_intensity INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS pairwise_matches (
        match_id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        game_a_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        game_b_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        chosen_game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        prompt_type TEXT DEFAULT 'general',
        exercise_type TEXT DEFAULT 'pairwise',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS player_moods (
        mood_id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        mood_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS categories (
        category_id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS game_categories (
        game_id TEXT REFERENCES games(game_id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(category_id) ON DELETE CASCADE,
        PRIMARY KEY (game_id, category_id)
      );`
    ];

    for (const sql of schemas) {
      await client.execute(sql);
    }

    // Seed standard genre tags
    const seedGenres = [
      'RPG', 'Action', 'Adventure', 'Shooter', 'Platformer', 
      'Roguelike', 'Simulation', 'Strategy', 'Puzzle', 'Survival', 
      'Sports', 'Fighting', 'Metroidvania', 'Indie', 'MMO', 
      'Soulslike', 'Horror', 'Sandbox', 'Card & Board', 'Racing'
    ];
    for (const genre of seedGenres) {
      await client.execute({
        sql: `INSERT INTO categories (category_id, name) VALUES (?, ?) ON CONFLICT (name) DO NOTHING`,
        args: [require('crypto').randomUUID(), genre]
      });
    }

    console.log('Turso libSQL database schemas verified/created successfully.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
};

initDb();

module.exports = {
  // Translate Postgres $1 positional queries to SQLite ? queries
  query: async (text, params = []) => {
    let sqliteParams = [];
    let sqliteText = text;
    
    if (params && params.length > 0) {
      sqliteText = text.replace(/\$(\d+)/g, (match, p1) => {
        const paramIndex = parseInt(p1, 10) - 1;
        sqliteParams.push(params[paramIndex]);
        return '?';
      });
    }
    
    // Replace ILIKE with LIKE
    const fixedText = sqliteText.replace(/ ILIKE /g, ' LIKE ');

    try {
      const result = await client.execute({ sql: fixedText, args: sqliteParams });
      
      // Some routines expect rows array mapping directly
      const rows = result.rows.map(row => {
        const obj = {};
        for (const key of Object.keys(row)) {
          // Keep numeric behavior similar to pg
          obj[key] = row[key];
        }
        return obj;
      });

      return {
        rows: rows,
        rowCount: rows.length
      };
    } catch (e) {
      console.error('Database query error:', e, '\\nSQL:', fixedText, '\\nParams:', sqliteParams);
      throw e;
    }
  },
  client
};
