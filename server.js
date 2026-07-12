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

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const formattedEmail = email.toLowerCase().trim();
    // Check if user exists
    const checkRes = await db.query('SELECT * FROM users WHERE email = $1', [formattedEmail]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const userId = crypto.randomUUID();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    await db.query(
      'INSERT INTO users (user_id, email, password_hash) VALUES ($1, $2, $3)', 
      [userId, formattedEmail, passwordHash]
    );

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { userId, email: formattedEmail }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const formattedEmail = email.toLowerCase().trim();
    const checkRes = await db.query('SELECT * FROM users WHERE email = $1', [formattedEmail]);
    const user = checkRes.rows[0];

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

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const checkRes = await db.query('SELECT user_id, email, created_at FROM users WHERE user_id = $1', [req.user.userId]);
    const user = checkRes.rows[0];
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

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const queryRes = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.userId]);
    res.json(queryRes.rows);
  } catch (err) {
    console.error('Get subscriptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/subscriptions', authenticateToken, async (req, res) => {
  const { name, monthly_cost, is_active } = req.body;
  if (!name || monthly_cost === undefined) {
    return res.status(400).json({ error: 'Name and monthly cost are required' });
  }

  try {
    const subscriptionId = crypto.randomUUID();
    const isActiveVal = is_active !== false;
    
    await db.query(`
      INSERT INTO subscriptions (subscription_id, user_id, name, monthly_cost, is_active)
      VALUES ($1, $2, $3, $4, $5)
    `, [subscriptionId, req.user.userId, name, parseFloat(monthly_cost), isActiveVal]);
    
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

app.put('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  const { name, monthly_cost, is_active } = req.body;
  const { id } = req.params;

  try {
    const subRes = await db.query('SELECT * FROM subscriptions WHERE subscription_id = $1 AND user_id = $2', [id, req.user.userId]);
    const sub = subRes.rows[0];
    if (!sub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const updatedName = name || sub.name;
    const updatedCost = monthly_cost !== undefined ? parseFloat(monthly_cost) : parseFloat(sub.monthly_cost);
    const updatedActive = is_active !== undefined ? !!is_active : sub.is_active;

    await db.query(`
      UPDATE subscriptions 
      SET name = $1, monthly_cost = $2, is_active = $3
      WHERE subscription_id = $4 AND user_id = $5
    `, [updatedName, updatedCost, updatedActive, id, req.user.userId]);

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

app.delete('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await db.query('DELETE FROM subscriptions WHERE subscription_id = $1 AND user_id = $2', [id, req.user.userId]);
    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ success: true, message: 'Subscription deleted' });
  } catch (err) {
    console.error('Delete subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- AMORTIZATION ENGINE HELPER ---
const getSubscriptionAmortization = async (userId) => {
  const resSubs = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
  const subs = resSubs.rows;
  const gameAmortized = {};
  let totalWaste = 0;
  const wasteBreakdown = [];

  for (const sub of subs) {
    const resGames = await db.query('SELECT game_id FROM games WHERE user_id = $1 AND subscription_id = $2', [userId, sub.subscription_id]);
    const games = resGames.rows;
    
    if (games.length === 0) {
      if (sub.is_active) {
        const subCost = parseFloat(sub.monthly_cost);
        totalWaste += subCost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: subCost,
          reason: 'No games associated'
        });
      }
      continue;
    }

    const gameIds = games.map(g => g.game_id);

    // Fetch play logs for these games
    const resLogs = await db.query(`
      SELECT game_id, hours_played, logged_date 
      FROM play_logs 
      WHERE game_id = ANY($1::uuid[])
      ORDER BY logged_date ASC
    `, [gameIds]);
    const logs = resLogs.rows;

    // Group logs by month ("YYYY-MM")
    const logsByMonth = {};
    let earliestDate = new Date();
    let latestDate = new Date();

    if (logs.length > 0) {
      earliestDate = new Date(logs[0].logged_date);
      latestDate = new Date(logs[logs.length - 1].logged_date);
      
      logs.forEach(log => {
        const dateStr = new Date(log.logged_date).toISOString().substring(0, 10);
        const monthStr = dateStr.substring(0, 7); // "YYYY-MM"
        if (!logsByMonth[monthStr]) {
          logsByMonth[monthStr] = [];
        }
        logsByMonth[monthStr].push({
          ...log,
          hours_played: parseFloat(log.hours_played),
          logged_date: dateStr
        });
      });
    } else {
      if (sub.is_active) {
        const subCost = parseFloat(sub.monthly_cost);
        totalWaste += subCost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: subCost,
          reason: 'No play hours logged yet'
        });
      }
      continue;
    }

    // Determine billing periods (months)
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    const startYear = earliestDate.getFullYear();
    const startMonth = earliestDate.getMonth();

    const endYear = sub.is_active ? new Date().getFullYear() : latestDate.getFullYear();
    const endMonth = sub.is_active ? new Date().getMonth() : latestDate.getMonth();

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
      const subCost = parseFloat(sub.monthly_cost);

      if (totalHoursInMonth > 0) {
        monthLogs.forEach(log => {
          const ratio = log.hours_played / totalHoursInMonth;
          const allocatedCost = subCost * ratio;
          gameAmortized[log.game_id] = (gameAmortized[log.game_id] || 0) + allocatedCost;
        });
      } else {
        totalWaste += subCost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: subCost,
          month: mStr,
          reason: '0 play hours in this month'
        });
      }
    });
  }

  return { gameAmortized, totalWaste, wasteBreakdown };
};

// --- GAMES ROUTES ---

app.get('/api/games', authenticateToken, async (req, res) => {
  try {
    const resGames = await db.query(`
      SELECT g.*, s.name as subscription_name 
      FROM games g 
      LEFT JOIN subscriptions s ON g.subscription_id = s.subscription_id
      WHERE g.user_id = $1
    `, [req.user.userId]);
    const games = resGames.rows;

    const { gameAmortized, totalWaste, wasteBreakdown } = await getSubscriptionAmortization(req.user.userId);

    // Calculate aggregated statistics for each game in parallel
    const gamesWithMetrics = await Promise.all(games.map(async (game) => {
      // 1. Sum up DLC/microtransactions
      const purchasesRes = await db.query('SELECT SUM(cost) as total FROM game_purchases WHERE game_id = $1', [game.game_id]);
      const addonCost = purchasesRes.rows[0].total ? parseFloat(purchasesRes.rows[0].total) : 0.00;

      // 2. Sum up total hours played
      const logsRes = await db.query('SELECT SUM(hours_played) as total FROM play_logs WHERE game_id = $1', [game.game_id]);
      const totalHours = logsRes.rows[0].total ? parseFloat(logsRes.rows[0].total) : 0.00;

      // 3. Get qualitative profile
      const qualRes = await db.query('SELECT * FROM qualitative_profiles WHERE game_id = $1', [game.game_id]);
      let qualitative = qualRes.rows[0] || null;
      
      const defaultPillars = {
        story: 5,
        multiplayer: 5,
        mechanics: 5,
        graphics: 5,
        challenge: 5,
        relaxation: 5,
        pacing: 5,
        engagement: 5,
        social: 5,
        stress_intensity: 5
      };

      const qualitativeObj = qualitative ? {
        story: qualitative.story ?? 5,
        multiplayer: qualitative.multiplayer ?? 5,
        mechanics: qualitative.mechanics ?? 5,
        graphics: qualitative.graphics ?? 5,
        challenge: qualitative.challenge ?? 5,
        relaxation: qualitative.relaxation ?? 5,
        pacing: qualitative.pacing ?? 5,
        engagement: qualitative.engagement ?? 5,
        social: qualitative.social ?? 5,
        stress_intensity: qualitative.stress_intensity ?? 5
      } : defaultPillars;

      // 3b. Fetch category tags
      const catsRes = await db.query(`
        SELECT c.name 
        FROM categories c
        JOIN game_categories gc ON c.category_id = gc.category_id
        WHERE gc.game_id = $1
      `, [game.game_id]);
      const categories = catsRes.rows.map(r => r.name);

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
        qualitative: qualitativeObj,
        categories
      };
    }));

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

app.post('/api/games', authenticateToken, async (req, res) => {
  const { title, acquisition_type, subscription_id, base_cost, qualitative, total_hours, unplayed, categories } = req.body;
  
  if (!title || !acquisition_type) {
    return res.status(400).json({ error: 'Title and acquisition type are required' });
  }

  try {
    const gameId = crypto.randomUUID();
    const finalBaseCost = (acquisition_type === 'free' || acquisition_type === 'f2p') ? 0.00 : parseFloat(base_cost || 0);
    const finalSubId = acquisition_type === 'subscription' ? subscription_id : null;
    const finalUnplayed = unplayed === true || unplayed === 'true';
    const initialStatus = finalUnplayed ? 'unplayed' : 'playing';

    // 1. Insert Game
    await db.query(`
      INSERT INTO games (game_id, user_id, title, acquisition_type, subscription_id, base_cost, unplayed, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [gameId, req.user.userId, title, acquisition_type, finalSubId, finalBaseCost, finalUnplayed, initialStatus]);

    // 2. Insert Qualitative Profile (default 5 or user custom, expanded to 10 pillars)
    const q = qualitative || {};
    await db.query(`
      INSERT INTO qualitative_profiles (profile_id, game_id, story, multiplayer, mechanics, graphics, challenge, relaxation, pacing, engagement, social, stress_intensity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      crypto.randomUUID(),
      gameId,
      parseInt(q.story ?? 5),
      parseInt(q.multiplayer ?? 5),
      parseInt(q.mechanics ?? 5),
      parseInt(q.graphics ?? 5),
      parseInt(q.challenge ?? 5),
      parseInt(q.relaxation ?? 5),
      parseInt(q.pacing ?? 5),
      parseInt(q.engagement ?? 5),
      parseInt(q.social ?? 5),
      parseInt(q.stress_intensity ?? 5)
    ]);

    // 3. Insert Category tag mappings
    if (categories && Array.isArray(categories)) {
      for (const catName of categories) {
        if (catName && catName.trim()) {
          const cleanCat = catName.trim();
          await db.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [cleanCat]);
          const catRes = await db.query('SELECT category_id FROM categories WHERE name = $1', [cleanCat]);
          const catId = catRes.rows[0].category_id;
          await db.query('INSERT INTO game_categories (game_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [gameId, catId]);
        }
      }
    }

    if (total_hours !== undefined && parseFloat(total_hours) > 0) {
      const logId = crypto.randomUUID();
      const today = new Date().toISOString().substring(0, 10);
      await db.query(`
        INSERT INTO play_logs (log_id, game_id, hours_played, logged_date)
        VALUES ($1, $2, $3, $4)
      `, [logId, gameId, parseFloat(total_hours), today]);
    }

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

app.put('/api/games/:id', authenticateToken, async (req, res) => {
  const { title, acquisition_type, subscription_id, base_cost, qualitative, total_hours, unplayed, status, score_100, recommend, categories } = req.body;
  const { id } = req.params;

  try {
    const gameRes = await db.query('SELECT * FROM games WHERE game_id = $1 AND user_id = $2', [id, req.user.userId]);
    const game = gameRes.rows[0];
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const updatedTitle = title || game.title;
    const updatedAcq = acquisition_type || game.acquisition_type;
    const updatedSubId = updatedAcq === 'subscription' ? (subscription_id || game.subscription_id) : null;
    const updatedBaseCost = (updatedAcq === 'free' || updatedAcq === 'f2p') ? 0.00 : parseFloat(base_cost !== undefined ? base_cost : game.base_cost);
    
    const finalUnplayed = unplayed !== undefined ? (unplayed === true || unplayed === 'true') : game.unplayed;
    
    // Status Resolution: Default status to playing if unplayed is turned off, and unplayed if toggled on
    let finalStatus = status || game.status || 'playing';
    if (finalUnplayed) {
      finalStatus = 'unplayed';
    } else if (game.unplayed && !finalUnplayed) {
      finalStatus = 'playing'; // automatically move back to playing if unplayed toggled off
    }

    // Elo rating changes based on game completion state
    const oldStatus = game.status || 'playing';
    let newElo = game.elo_rating || 1200;

    if (oldStatus !== 'Finished' && finalStatus === 'Finished') {
      newElo += 50; // Finish boost
    } else if (oldStatus === 'Finished' && finalStatus !== 'Finished') {
      newElo -= 50; // Revert boost
    }

    if (oldStatus !== 'Did not Finish' && finalStatus === 'Did not Finish') {
      newElo -= 50; // DNF penalty
    } else if (oldStatus === 'Did not Finish' && finalStatus !== 'Did not Finish') {
      newElo += 50; // Revert DNF
    }

    await db.query(`
      UPDATE games 
      SET title = $1, acquisition_type = $2, subscription_id = $3, base_cost = $4,
          unplayed = $5, status = $6, score_100 = $7, recommend = $8, elo_rating = $9
      WHERE game_id = $10 AND user_id = $11
    `, [
      updatedTitle,
      updatedAcq,
      updatedSubId,
      updatedBaseCost,
      finalUnplayed,
      finalStatus,
      score_100 !== undefined ? (score_100 === null || score_100 === '' ? null : parseInt(score_100)) : game.score_100,
      recommend !== undefined ? (recommend === null || recommend === '' ? null : (recommend === true || recommend === 'true')) : game.recommend,
      newElo,
      id,
      req.user.userId
    ]);

    if (qualitative) {
      await db.query(`
        UPDATE qualitative_profiles 
        SET story = $1, multiplayer = $2, mechanics = $3, graphics = $4, challenge = $5, 
            relaxation = $6, pacing = $7, engagement = $8, social = $9, stress_intensity = $10
        WHERE game_id = $11
      `, [
        parseInt(qualitative.story ?? 5),
        parseInt(qualitative.multiplayer ?? 5),
        parseInt(qualitative.mechanics ?? 5),
        parseInt(qualitative.graphics ?? 5),
        parseInt(qualitative.challenge ?? 5),
        parseInt(qualitative.relaxation ?? 5),
        parseInt(qualitative.pacing ?? 5),
        parseInt(qualitative.engagement ?? 5),
        parseInt(qualitative.social ?? 5),
        parseInt(qualitative.stress_intensity ?? 5),
        id
      ]);
    }

    // Sync categories
    if (categories && Array.isArray(categories)) {
      await db.query('DELETE FROM game_categories WHERE game_id = $1', [id]);
      for (const catName of categories) {
        if (catName && catName.trim()) {
          const cleanCat = catName.trim();
          await db.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [cleanCat]);
          const catRes = await db.query('SELECT category_id FROM categories WHERE name = $1', [cleanCat]);
          const catId = catRes.rows[0].category_id;
          await db.query('INSERT INTO game_categories (game_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, catId]);
        }
      }
    }

    if (total_hours !== undefined) {
      const targetHours = parseFloat(total_hours);
      if (!isNaN(targetHours) && targetHours >= 0) {
        const sumRes = await db.query('SELECT SUM(hours_played) as total FROM play_logs WHERE game_id = $1', [id]);
        const currentHours = sumRes.rows[0].total ? parseFloat(sumRes.rows[0].total) : 0.00;
        
        const diff = targetHours - currentHours;
        if (Math.abs(diff) > 0.01) {
          if (diff > 0) {
            const logId = crypto.randomUUID();
            const today = new Date().toISOString().substring(0, 10);
            await db.query(`
              INSERT INTO play_logs (log_id, game_id, hours_played, logged_date)
              VALUES ($1, $2, $3, $4)
            `, [logId, id, diff, today]);
          } else {
            let amountToSubtract = Math.abs(diff);
            const logsRes = await db.query(`
              SELECT log_id, hours_played 
              FROM play_logs 
              WHERE game_id = $1 
              ORDER BY logged_date DESC, log_id DESC
            `, [id]);
            
            for (const log of logsRes.rows) {
              const logHours = parseFloat(log.hours_played);
              if (logHours <= amountToSubtract) {
                await db.query('DELETE FROM play_logs WHERE log_id = $1', [log.log_id]);
                amountToSubtract -= logHours;
              } else {
                const newHours = logHours - amountToSubtract;
                await db.query('UPDATE play_logs SET hours_played = $1 WHERE log_id = $2', [newHours, log.log_id]);
                amountToSubtract = 0;
                break;
              }
            }
          }
        }
      }
    }

    res.json({ success: true, message: 'Game updated successfully' });
  } catch (err) {
    console.error('Update game error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/games/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await db.query('DELETE FROM games WHERE game_id = $1 AND user_id = $2', [id, req.user.userId]);
    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ success: true, message: 'Game deleted' });
  } catch (err) {
    console.error('Delete game error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GAME PURCHASES (ADD-ONS) ROUTES ---

app.get('/api/games/:id/purchases', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const purchasesRes = await db.query(`
      SELECT p.* FROM game_purchases p 
      JOIN games g ON p.game_id = g.game_id
      WHERE p.game_id = $1 AND g.user_id = $2
      ORDER BY p.purchased_at DESC
    `, [id, req.user.userId]);
    res.json(purchasesRes.rows);
  } catch (err) {
    console.error('Get purchases error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/games/:id/purchases', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { description, cost } = req.body;

  if (!description || cost === undefined) {
    return res.status(400).json({ error: 'Description and cost are required' });
  }

  try {
    const gameRes = await db.query('SELECT * FROM games WHERE game_id = $1 AND user_id = $2', [id, req.user.userId]);
    if (gameRes.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const purchaseId = crypto.randomUUID();
    await db.query(`
      INSERT INTO game_purchases (purchase_id, game_id, description, cost)
      VALUES ($1, $2, $3, $4)
    `, [purchaseId, id, description, parseFloat(cost)]);

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

app.delete('/api/purchases/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Make sure purchase belongs to user's game
    const purchaseRes = await db.query(`
      SELECT p.purchase_id FROM game_purchases p 
      JOIN games g ON p.game_id = g.game_id
      WHERE p.purchase_id = $1 AND g.user_id = $2
    `, [id, req.user.userId]);

    if (purchaseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    await db.query('DELETE FROM game_purchases WHERE purchase_id = $1', [id]);
    res.json({ success: true, message: 'Purchase deleted' });
  } catch (err) {
    console.error('Delete purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- PLAY LOGS ROUTES ---

app.get('/api/games/:id/logs', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const logsRes = await db.query(`
      SELECT l.* FROM play_logs l 
      JOIN games g ON l.game_id = g.game_id
      WHERE l.game_id = $1 AND g.user_id = $2
      ORDER BY l.logged_date DESC
    `, [id, req.user.userId]);

    // Format dates to string for consistency
    const logs = logsRes.rows.map(log => ({
      ...log,
      logged_date: new Date(log.logged_date).toISOString().substring(0, 10),
      hours_played: parseFloat(log.hours_played)
    }));

    res.json(logs);
  } catch (err) {
    console.error('Get play logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/games/:id/logs', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { hours_played, logged_date } = req.body;

  if (hours_played === undefined || !logged_date) {
    return res.status(400).json({ error: 'Hours played and log date are required' });
  }

  try {
    const gameRes = await db.query('SELECT * FROM games WHERE game_id = $1 AND user_id = $2', [id, req.user.userId]);
    if (gameRes.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const logId = crypto.randomUUID();
    const dateObj = new Date(logged_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const formattedDate = dateObj.toISOString().substring(0, 10); // Store as YYYY-MM-DD

    await db.query(`
      INSERT INTO play_logs (log_id, game_id, hours_played, logged_date)
      VALUES ($1, $2, $3, $4)
    `, [logId, id, parseFloat(hours_played), formattedDate]);

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

app.delete('/api/logs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const logRes = await db.query(`
      SELECT l.log_id FROM play_logs l 
      JOIN games g ON l.game_id = g.game_id
      WHERE l.log_id = $1 AND g.user_id = $2
    `, [id, req.user.userId]);

    if (logRes.rows.length === 0) {
      return res.status(404).json({ error: 'Play log not found' });
    }

    await db.query('DELETE FROM play_logs WHERE log_id = $1', [id]);
    res.json({ success: true, message: 'Play log deleted' });
  } catch (err) {
    console.error('Delete play log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- PAIRWISE MATCHMAKING & ELO ROUTES ---

app.get('/api/pairwise/match', authenticateToken, async (req, res) => {
  try {
    // 1. Fetch user games that have unplayed = false AND have at least one log entry (or total_hours > 0)
    const gamesRes = await db.query(`
      SELECT game_id, title, elo_rating, match_count 
      FROM games 
      WHERE user_id = $1 
        AND unplayed = FALSE
        AND game_id IN (SELECT DISTINCT game_id FROM play_logs)
    `, [req.user.userId]);
    const games = gamesRes.rows;
    
    if (games.length < 2) {
      return res.status(400).json({ error: 'You need at least 2 games in your library to start comparison matches.' });
    }

    // 2. Smart Matchmaking:
    // Select Game A randomly, but give preference to games with fewer matches
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

app.post('/api/pairwise/match', authenticateToken, async (req, res) => {
  const { game_a_id, game_b_id, chosen_game_id } = req.body;

  if (!game_a_id || !game_b_id || !chosen_game_id) {
    return res.status(400).json({ error: 'game_a_id, game_b_id, and chosen_game_id are required' });
  }

  if (chosen_game_id !== game_a_id && chosen_game_id !== game_b_id) {
    return res.status(400).json({ error: 'Chosen game must be either Game A or Game B' });
  }

  try {
    // 1. Fetch current details of games
    const resA = await db.query('SELECT game_id, elo_rating, match_count FROM games WHERE game_id = $1 AND user_id = $2', [game_a_id, req.user.userId]);
    const resB = await db.query('SELECT game_id, elo_rating, match_count FROM games WHERE game_id = $1 AND user_id = $2', [game_b_id, req.user.userId]);
    
    const gameA = resA.rows[0];
    const gameB = resB.rows[0];

    if (!gameA || !gameB) {
      return res.status(404).json({ error: 'One or both games not found' });
    }

    const ratingA = gameA.elo_rating;
    const ratingB = gameB.elo_rating;

    // 2. Calculate ELO expectations
    const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    const K = 32;

    const SA = chosen_game_id === game_a_id ? 1 : 0;
    const SB = chosen_game_id === game_b_id ? 1 : 0;

    const newRatingA = Math.round(ratingA + K * (SA - EA));
    const newRatingB = Math.round(ratingB + K * (SB - EB));

    // 3. Log match
    const matchId = crypto.randomUUID();
    await db.query(`
      INSERT INTO pairwise_matches (match_id, user_id, game_a_id, game_b_id, chosen_game_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [matchId, req.user.userId, game_a_id, game_b_id, chosen_game_id]);

    // 4. Update games
    await db.query(`
      UPDATE games 
      SET elo_rating = $1, match_count = match_count + 1 
      WHERE game_id = $2
    `, [newRatingA, game_a_id]);

    await db.query(`
      UPDATE games 
      SET elo_rating = $1, match_count = match_count + 1 
      WHERE game_id = $2
    `, [newRatingB, game_b_id]);

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

// --- CATEGORY & METADATA SEARCH ROUTES ---

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const catRes = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(catRes.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  try {
    const cleanName = name.trim();
    await db.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [cleanName]);
    const catRes = await db.query('SELECT * FROM categories WHERE name = $1', [cleanName]);
    res.json(catRes.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/games/suggest-categories', authenticateToken, async (req, res) => {
  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Game title is required' });
  }
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=en&format=json&type=item&limit=5`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'ValueEngineGameLedger/1.0 (klawgames@example.com)' }
    });
    const searchData = await searchRes.json();
    
    if (!searchData.search || searchData.search.length === 0) {
      return res.json([]);
    }

    let bestEntity = searchData.search[0];
    for (const entity of searchData.search) {
      const desc = (entity.description || '').toLowerCase();
      if (desc.includes('video game') || desc.includes('role-playing game') || desc.includes('shooter game')) {
        bestEntity = entity;
        break;
      }
    }

    const entityId = bestEntity.id;
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&languages=en&format=json&props=claims`;
    const entityRes = await fetch(entityUrl, {
      headers: { 'User-Agent': 'ValueEngineGameLedger/1.0 (klawgames@example.com)' }
    });
    const entityData = await entityRes.json();

    const claims = entityData.entities[entityId].claims;
    const genreClaims = claims['P136'];
    if (!genreClaims || genreClaims.length === 0) {
      return res.json([]);
    }

    const genreQids = genreClaims.map(claim => {
      const datavalue = claim.mainsnak.datavalue;
      return datavalue && datavalue.value && datavalue.value.id;
    }).filter(Boolean);

    if (genreQids.length === 0) {
      return res.json([]);
    }

    const labelsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${genreQids.join('|')}&languages=en&format=json&props=labels`;
    const labelsRes = await fetch(labelsUrl, {
      headers: { 'User-Agent': 'ValueEngineGameLedger/1.0 (klawgames@example.com)' }
    });
    const labelsData = await labelsRes.json();

    const genres = [];
    for (const qid of genreQids) {
      const entity = labelsData.entities[qid];
      if (entity && entity.labels && entity.labels.en) {
        genres.push(entity.labels.en.value);
      }
    }
    
    res.json(genres);
  } catch (err) {
    console.error('Suggest categories error:', err);
    res.status(500).json({ error: 'Failed to suggest categories' });
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

// Avoid app.listen when running under Vercel Serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
