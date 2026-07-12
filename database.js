const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Proactively load local .env file if it exists for development setup
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      // Unquote value if quoted
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL environment variable is not defined. PostgreSQL database operations will fail.');
}

const pool = new Pool({
  connectionString,
  // Supabase/Neon require SSL. We reject unauthorized = false to allow self-signed certificates.
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Setup schemas on initialization
const initDb = async () => {
  if (!connectionString) return;
  try {
    console.log('Connecting to PostgreSQL database and running migrations...');
    
    // Enable uuid generator extension in Postgres if not already present
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        monthly_cost NUMERIC(6, 2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        acquisition_type VARCHAR(50) NOT NULL,
        subscription_id UUID REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
        base_cost NUMERIC(6, 2) DEFAULT 0.00,
        elo_rating INTEGER DEFAULT 1200,
        match_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_purchases (
        purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        description VARCHAR(255) NOT NULL,
        cost NUMERIC(6, 2) NOT NULL,
        purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS play_logs (
        log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        hours_played NUMERIC(5, 2) NOT NULL,
        logged_date TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS qualitative_profiles (
        profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        story INT CHECK (story BETWEEN 0 AND 10),
        multiplayer INT CHECK (multiplayer BETWEEN 0 AND 10),
        mechanics INT CHECK (mechanics BETWEEN 0 AND 10),
        graphics INT CHECK (graphics BETWEEN 0 AND 10),
        challenge INT CHECK (challenge BETWEEN 0 AND 10),
        relaxation INT CHECK (relaxation BETWEEN 0 AND 10),
        pacing INT CHECK (pacing BETWEEN 0 AND 10)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pairwise_matches (
        match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
        game_a_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        game_b_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        chosen_game_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Schema Migration Section ---
    console.log('Running database schema updates...');
    
    // 1. Add status and unplayed columns to games table
    await pool.query("ALTER TABLE games ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'playing';");
    await pool.query("ALTER TABLE games ADD COLUMN IF NOT EXISTS score_100 INT CHECK (score_100 BETWEEN 0 AND 100) NULL;");
    await pool.query("ALTER TABLE games ADD COLUMN IF NOT EXISTS recommend BOOLEAN NULL;");
    await pool.query("ALTER TABLE games ADD COLUMN IF NOT EXISTS unplayed BOOLEAN DEFAULT FALSE;");

    // 2. Add new split qualitative pillars to qualitative_profiles
    await pool.query("ALTER TABLE qualitative_profiles ADD COLUMN IF NOT EXISTS engagement INT CHECK (engagement BETWEEN 0 AND 10);");
    await pool.query("ALTER TABLE qualitative_profiles ADD COLUMN IF NOT EXISTS social INT CHECK (social BETWEEN 0 AND 10);");
    await pool.query("ALTER TABLE qualitative_profiles ADD COLUMN IF NOT EXISTS stress_intensity INT CHECK (stress_intensity BETWEEN 0 AND 10);");

    // 3. Create categories reference table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL
      );
    `);

    // 4. Create game-category join mapping table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_categories (
        game_id UUID REFERENCES games(game_id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(category_id) ON DELETE CASCADE,
        PRIMARY KEY (game_id, category_id)
      );
    `);

    // 5. Seed standard genre tags
    await pool.query(`
      INSERT INTO categories (name) VALUES 
        ('RPG'), ('Action'), ('Adventure'), ('Shooter'), ('Platformer'), 
        ('Roguelike'), ('Simulation'), ('Strategy'), ('Puzzle'), ('Survival'), 
        ('Sports'), ('Fighting'), ('Metroidvania'), ('Indie'), ('MMO'), 
        ('Soulslike'), ('Horror'), ('Sandbox'), ('Card & Board'), ('Racing')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('PostgreSQL database schemas verified/created successfully.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
};

initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
