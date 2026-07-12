const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'entertainment_value_secret_key_2026';

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = { userId: decoded.userId };
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Check if user exists
    const checkStmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const existingUser = checkStmt.get(email.toLowerCase().trim());
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const userId = crypto.randomUUID();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const insertStmt = db.prepare('INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)');
    insertStmt.run(userId, email.toLowerCase().trim(), passwordHash);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { userId, email: email.toLowerCase().trim() }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { userId: user.user_id, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT user_id, email, created_at FROM users WHERE user_id = ?').get(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- SUBSCRIPTIONS ROUTES ---

app.get('/api/subscriptions', authenticateToken, (req, res) => {
  try {
    const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(req.user.userId);
    res.json(subs);
  } catch (err) {
    console.error('Get subscriptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/subscriptions', authenticateToken, (req, res) => {
  const { name, monthly_cost, is_active } = req.body;
  if (!name || monthly_cost === undefined) {
    return res.status(400).json({ error: 'Name and monthly cost are required' });
  }

  try {
    const subscriptionId = crypto.randomUUID();
    const isActiveVal = is_active === false ? 0 : 1;
    const stmt = db.prepare(`
      INSERT INTO subscriptions (subscription_id, user_id, name, monthly_cost, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(subscriptionId, req.user.userId, name, parseFloat(monthly_cost), isActiveVal);
    
    res.status(201).json({
      subscription_id: subscriptionId,
      user_id: req.user.userId,
      name,
      monthly_cost: parseFloat(monthly_cost),
      is_active: isActiveVal
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/subscriptions/:id', authenticateToken, (req, res) => {
  const { name, monthly_cost, is_active } = req.body;
  const { id } = req.params;

  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE subscription_id = ? AND user_id = ?').get(id, req.user.userId);
    if (!sub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const updatedName = name || sub.name;
    const updatedCost = monthly_cost !== undefined ? parseFloat(monthly_cost) : sub.monthly_cost;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : sub.is_active;

    const stmt = db.prepare(`
      UPDATE subscriptions 
      SET name = ?, monthly_cost = ?, is_active = ?
      WHERE subscription_id = ? AND user_id = ?
    `);
    stmt.run(updatedName, updatedCost, updatedActive, id, req.user.userId);

    res.json({
      subscription_id: id,
      name: updatedName,
      monthly_cost: updatedCost,
      is_active: updatedActive
    });
  } catch (err) {
    console.error('Update subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/subscriptions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM subscriptions WHERE subscription_id = ? AND user_id = ?');
    const result = stmt.run(id, req.user.userId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ success: true, message: 'Subscription deleted' });
  } catch (err) {
    console.error('Delete subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- AMORTIZATION ENGINE HELPER ---
const getSubscriptionAmortization = (userId) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(userId);
  const gameAmortized = {};
  let totalWaste = 0;
  const wasteBreakdown = []; // detail of wasted subs for dashboard

  for (const sub of subs) {
    // Find all games linked to this subscription
    const games = db.prepare('SELECT game_id FROM games WHERE user_id = ? AND subscription_id = ?').all(userId, sub.subscription_id);
    
    if (games.length === 0) {
      // If no games are registered under this subscription, then if active, current month is waste
      if (sub.is_active === 1) {
        totalWaste += sub.monthly_cost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: sub.monthly_cost,
          reason: 'No games associated'
        });
      }
      continue;
    }

    const gameIds = games.map(g => g.game_id);
    const placeholders = gameIds.map(() => '?').join(',');

    // Fetch play logs for these games
    const logs = db.prepare(`
      SELECT game_id, hours_played, logged_date 
      FROM play_logs 
      WHERE game_id IN (${placeholders})
      ORDER BY logged_date ASC
    `).all(...gameIds);

    // Group logs by month ("YYYY-MM")
    const logsByMonth = {};
    let earliestDate = new Date();
    let latestDate = new Date();

    if (logs.length > 0) {
      earliestDate = new Date(logs[0].logged_date);
      latestDate = new Date(logs[logs.length - 1].logged_date);
      
      logs.forEach(log => {
        const monthStr = log.logged_date.substring(0, 7); // "YYYY-MM"
        if (!logsByMonth[monthStr]) {
          logsByMonth[monthStr] = [];
        }
        logsByMonth[monthStr].push(log);
      });
    } else {
      // No logs ever recorded
      if (sub.is_active === 1) {
        totalWaste += sub.monthly_cost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: sub.monthly_cost,
          reason: 'No play hours logged yet'
        });
      }
      continue;
    }

    // Determine billing periods (months)
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    const startYear = earliestDate.getFullYear();
    const startMonth = earliestDate.getMonth();

    const endYear = sub.is_active === 1 ? new Date().getFullYear() : latestDate.getFullYear();
    const endMonth = sub.is_active === 1 ? new Date().getMonth() : latestDate.getMonth();

    const billingMonths = [];
    let currYear = startYear;
    let currMon = startMonth;

    while (currYear < endYear || (currYear === endYear && currMon <= endMonth)) {
      const mStr = `${currYear}-${String(currMon + 1).padStart(2, '0')}`;
      billingMonths.push(mStr);
      currMon++;
      if (currMon > 11) {
        currMon = 0;
        currYear++;
      }
    }

    // Allocate monthly costs
    billingMonths.forEach(mStr => {
      const monthLogs = logsByMonth[mStr] || [];
      const totalHoursInMonth = monthLogs.reduce((sum, l) => sum + l.hours_played, 0);

      if (totalHoursInMonth > 0) {
        monthLogs.forEach(log => {
          const ratio = log.hours_played / totalHoursInMonth;
          const allocatedCost = sub.monthly_cost * ratio;
          gameAmortized[log.game_id] = (gameAmortized[log.game_id] || 0) + allocatedCost;
        });
      } else {
        // Active subscription month with 0 hours logged: waste!
        totalWaste += sub.monthly_cost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: sub.monthly_cost,
          month: mStr,
          reason: '0 play hours in this month'
        });
      }
    });
  }

  return { gameAmortized, totalWaste, wasteBreakdown };
};

// --- GAMES ROUTES ---

app.get('/api/games', authenticateToken, (req, res) => {
  try {
    const games = db.prepare(`
      SELECT g.*, s.name as subscription_name 
      FROM games g 
      LEFT JOIN subscriptions s ON g.subscription_id = s.subscription_id
      WHERE g.user_id = ?
    `).all(req.user.userId);

    const { gameAmortized, totalWaste, wasteBreakdown } = getSubscriptionAmortization(req.user.userId);

    // Calculate aggregated statistics for each game
    const gamesWithMetrics = games.map(game => {
      // 1. Sum up DLC/microtransactions
      const purchases = db.prepare('SELECT SUM(cost) as total FROM game_purchases WHERE game_id = ?').get(game.game_id);
      const addonCost = purchases && purchases.total ? parseFloat(purchases.total) : 0.00;

      // 2. Sum up total hours played
      const logs = db.prepare('SELECT SUM(hours_played) as total FROM play_logs WHERE game_id = ?').get(game.game_id);
      const totalHours = logs && logs.total ? parseFloat(logs.total) : 0.00;

      // 3. Get qualitative profile
      let qualitative = db.prepare('SELECT * FROM qualitative_profiles WHERE game_id = ?').get(game.game_id);
      if (qualitative) {
        delete qualitative.profile_id;
        delete qualitative.game_id;
      } else {
        qualitative = null;
      }

      // 4. Determine cost share based on acquisition
      let amortizedSubscriptionCost = 0.00;
      if (game.acquisition_type === 'subscription') {
        amortizedSubscriptionCost = gameAmortized[game.game_id] || 0.00;
      }

      const baseCost = game.acquisition_type === 'free' || game.acquisition_type === 'f2p' ? 0.00 : parseFloat(game.base_cost);
      const totalCost = baseCost + addonCost + amortizedSubscriptionCost;
      const cph = totalHours > 0 ? (totalCost / totalHours) : null;

      return {
        ...game,
        base_cost: baseCost,
        addon_cost: addonCost,
        amortized_subscription_cost: amortizedSubscriptionCost,
        total_cost: totalCost,
        total_hours: totalHours,
        cph,
        qualitative
      };
    });

    res.json({
      games: gamesWithMetrics,
      subscription_waste: totalWaste,
      waste_breakdown: wasteBreakdown
    });
  } catch (err) {
    console.error('Get games metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/games', authenticateToken, (req, res) => {
  const { title, acquisition_type, subscription_id, base_cost, qualitative } = req.body;
  
  if (!title || !acquisition_type) {
    return res.status(400).json({ error: 'Title and acquisition type are required' });
  }

  try {
    const gameId = crypto.randomUUID();
    const finalBaseCost = (acquisition_type === 'free' || acquisition_type === 'f2p') ? 0.00 : parseFloat(base_cost || 0);
    const finalSubId = acquisition_type === 'subscription' ? subscription_id : null;

    // 1. Insert Game
    const gameStmt = db.prepare(`
      INSERT INTO games (game_id, user_id, title, acquisition_type, subscription_id, base_cost)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    gameStmt.run(gameId, req.user.userId, title, acquisition_type, finalSubId, finalBaseCost);

    // 2. Insert Qualitative Profile (default 0 or user custom)
    const q = qualitative || {};
    const qStmt = db.prepare(`
      INSERT INTO qualitative_profiles (profile_id, game_id, story, multiplayer, mechanics, graphics, challenge, relaxation, pacing)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    qStmt.run(
      crypto.randomUUID(),
      gameId,
      parseInt(q.story ?? 5),
      parseInt(q.multiplayer ?? 5),
      parseInt(q.mechanics ?? 5),
      parseInt(q.graphics ?? 5),
      parseInt(q.challenge ?? 5),
      parseInt(q.relaxation ?? 5),
      parseInt(q.pacing ?? 5)
    );

    res.status(201).json({
      game_id: gameId,
      title,
      acquisition_type,
      subscription_id: finalSubId,
      base_cost: finalBaseCost,
      elo_rating: 1200,
      match_count: 0
    });
  } catch (err) {
    console.error('Create game error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/games/:id', authenticateToken, (req, res) => {
  const { title, acquisition_type, subscription_id, base_cost, qualitative } = req.body;
  const { id } = req.params;

  try {
    const game = db.prepare('SELECT * FROM games WHERE game_id = ? AND user_id = ?').get(id, req.user.userId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const updatedTitle = title || game.title;
    const updatedAcq = acquisition_type || game.acquisition_type;
    const updatedSubId = updatedAcq === 'subscription' ? (subscription_id || game.subscription_id) : null;
    const updatedBaseCost = (updatedAcq === 'free' || updatedAcq === 'f2p') ? 0.00 : parseFloat(base_cost !== undefined ? base_cost : game.base_cost);

    const gameStmt = db.prepare(`
      UPDATE games 
      SET title = ?, acquisition_type = ?, subscription_id = ?, base_cost = ?
      WHERE game_id = ? AND user_id = ?
    `);
    gameStmt.run(updatedTitle, updatedAcq, updatedSubId, updatedBaseCost, id, req.user.userId);

    if (qualitative) {
      const qStmt = db.prepare(`
        UPDATE qualitative_profiles 
        SET story = ?, multiplayer = ?, mechanics = ?, graphics = ?, challenge = ?, relaxation = ?, pacing = ?
        WHERE game_id = ?
      `);
      qStmt.run(
        parseInt(qualitative.story ?? 5),
        parseInt(qualitative.multiplayer ?? 5),
        parseInt(qualitative.mechanics ?? 5),
        parseInt(qualitative.graphics ?? 5),
        parseInt(qualitative.challenge ?? 5),
        parseInt(qualitative.relaxation ?? 5),
        parseInt(qualitative.pacing ?? 5),
        id
      );
    }

    res.json({ success: true, message: 'Game updated successfully' });
  } catch (err) {
    console.error('Update game error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/games/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM games WHERE game_id = ? AND user_id = ?');
    const result = stmt.run(id, req.user.userId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ success: true, message: 'Game deleted' });
  } catch (err) {
    console.error('Delete game error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GAME PURCHASES (ADD-ONS) ROUTES ---

app.get('/api/games/:id/purchases', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const purchases = db.prepare(`
      SELECT p.* FROM game_purchases p 
      JOIN games g ON p.game_id = g.game_id
      WHERE p.game_id = ? AND g.user_id = ?
      ORDER BY p.purchased_at DESC
    `).all(id, req.user.userId);
    res.json(purchases);
  } catch (err) {
    console.error('Get purchases error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/games/:id/purchases', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { description, cost } = req.body;

  if (!description || cost === undefined) {
    return res.status(400).json({ error: 'Description and cost are required' });
  }

  try {
    const game = db.prepare('SELECT * FROM games WHERE game_id = ? AND user_id = ?').get(id, req.user.userId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const purchaseId = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO game_purchases (purchase_id, game_id, description, cost)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(purchaseId, id, description, parseFloat(cost));

    res.status(201).json({
      purchase_id: purchaseId,
      game_id: id,
      description,
      cost: parseFloat(cost)
    });
  } catch (err) {
    console.error('Add purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/purchases/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    // Make sure purchase belongs to user's game
    const purchase = db.prepare(`
      SELECT p.purchase_id FROM game_purchases p 
      JOIN games g ON p.game_id = g.game_id
      WHERE p.purchase_id = ? AND g.user_id = ?
    `).get(id, req.user.userId);

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    db.prepare('DELETE FROM game_purchases WHERE purchase_id = ?').run(id);
    res.json({ success: true, message: 'Purchase deleted' });
  } catch (err) {
    console.error('Delete purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- PLAY LOGS ROUTES ---

app.get('/api/games/:id/logs', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const logs = db.prepare(`
      SELECT l.* FROM play_logs l 
      JOIN games g ON l.game_id = g.game_id
      WHERE l.game_id = ? AND g.user_id = ?
      ORDER BY l.logged_date DESC
    `).all(id, req.user.userId);
    res.json(logs);
  } catch (err) {
    console.error('Get play logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/games/:id/logs', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { hours_played, logged_date } = req.body;

  if (hours_played === undefined || !logged_date) {
    return res.status(400).json({ error: 'Hours played and log date are required' });
  }

  try {
    const game = db.prepare('SELECT * FROM games WHERE game_id = ? AND user_id = ?').get(id, req.user.userId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const logId = crypto.randomUUID();
    // Validate date format YYYY-MM-DD
    const dateObj = new Date(logged_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const formattedDate = dateObj.toISOString().split('T')[0]; // Store as YYYY-MM-DD

    const stmt = db.prepare(`
      INSERT INTO play_logs (log_id, game_id, hours_played, logged_date)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(logId, id, parseFloat(hours_played), formattedDate);

    res.status(201).json({
      log_id: logId,
      game_id: id,
      hours_played: parseFloat(hours_played),
      logged_date: formattedDate
    });
  } catch (err) {
    console.error('Add play log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/logs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const log = db.prepare(`
      SELECT l.log_id FROM play_logs l 
      JOIN games g ON l.game_id = g.game_id
      WHERE l.log_id = ? AND g.user_id = ?
    `).get(id, req.user.userId);

    if (!log) {
      return res.status(404).json({ error: 'Play log not found' });
    }

    db.prepare('DELETE FROM play_logs WHERE log_id = ?').run(id);
    res.json({ success: true, message: 'Play log deleted' });
  } catch (err) {
    console.error('Delete play log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- PAIRWISE MATCHMAKING & ELO ROUTES ---

app.get('/api/pairwise/match', authenticateToken, (req, res) => {
  try {
    // 1. Fetch user games
    const games = db.prepare('SELECT game_id, title, elo_rating, match_count FROM games WHERE user_id = ?').all(req.user.userId);
    
    if (games.length < 2) {
      return res.status(400).json({ error: 'You need at least 2 games in your library to start comparison matches.' });
    }

    // 2. Smart Matchmaking:
    // Select Game A randomly, but give preference to games with fewer matches
    // Sort games by match_count ascending, then select from the bottom 30% randomly
    games.sort((a, b) => a.match_count - b.match_count);
    const poolSize = Math.max(1, Math.floor(games.length * 0.4));
    const randomIdx = Math.floor(Math.random() * poolSize);
    const gameA = games[randomIdx];

    // Find Game B which has the closest Elo rating to Game A
    let gameB = null;
    let minDiff = Infinity;

    for (const g of games) {
      if (g.game_id === gameA.game_id) continue;
      const diff = Math.abs(g.elo_rating - gameA.elo_rating);
      if (diff < minDiff) {
        minDiff = diff;
        gameB = g;
      }
    }

    // Fallback in case of some weird issue
    if (!gameB) {
      gameB = games.find(g => g.game_id !== gameA.game_id);
    }

    res.json({ gameA, gameB });
  } catch (err) {
    console.error('Matchmaking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pairwise/match', authenticateToken, (req, res) => {
  const { game_a_id, game_b_id, chosen_game_id } = req.body;

  if (!game_a_id || !game_b_id || !chosen_game_id) {
    return res.status(400).json({ error: 'game_a_id, game_b_id, and chosen_game_id are required' });
  }

  if (chosen_game_id !== game_a_id && chosen_game_id !== game_b_id) {
    return res.status(400).json({ error: 'Chosen game must be either Game A or Game B' });
  }

  try {
    // 1. Fetch current details of games
    const gameA = db.prepare('SELECT game_id, elo_rating, match_count FROM games WHERE game_id = ? AND user_id = ?').get(game_a_id, req.user.userId);
    const gameB = db.prepare('SELECT game_id, elo_rating, match_count FROM games WHERE game_id = ? AND user_id = ?').get(game_b_id, req.user.userId);

    if (!gameA || !gameB) {
      return res.status(404).json({ error: 'One or both games not found' });
    }

    const ratingA = gameA.elo_rating;
    const ratingB = gameB.elo_rating;

    // 2. Calculate ELO expectations
    // Expected probability
    const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    // K-factor
    const K = 32;

    // Actual outcomes
    const SA = chosen_game_id === game_a_id ? 1 : 0;
    const SB = chosen_game_id === game_b_id ? 1 : 0;

    // New ratings
    const newRatingA = Math.round(ratingA + K * (SA - EA));
    const newRatingB = Math.round(ratingB + K * (SB - EB));

    // 3. Log match
    const matchId = crypto.randomUUID();
    const matchStmt = db.prepare(`
      INSERT INTO pairwise_matches (match_id, user_id, game_a_id, game_b_id, chosen_game_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    matchStmt.run(matchId, req.user.userId, game_a_id, game_b_id, chosen_game_id);

    // 4. Update games
    const updateStmt = db.prepare(`
      UPDATE games 
      SET elo_rating = ?, match_count = match_count + 1 
      WHERE game_id = ?
    `);
    updateStmt.run(newRatingA, game_a_id);
    updateStmt.run(newRatingB, game_b_id);

    res.json({
      gameA: {
        game_id: game_a_id,
        old_rating: ratingA,
        new_rating: newRatingA,
        match_count: gameA.match_count + 1
      },
      gameB: {
        game_id: game_b_id,
        old_rating: ratingB,
        new_rating: newRatingB,
        match_count: gameB.match_count + 1
      }
    });
  } catch (err) {
    console.error('Record match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- SERVER INITIALIZATION ---

const path = require('path');

// Serve static assets from frontend build
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Fallback to frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
