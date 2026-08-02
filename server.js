const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'entertainment_value_secret_key_2026';

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

    // Smart Session Recency Handler
    const prevLogin = user.last_login_at;
    let loginPrompt = 'daily'; // Default for new or consecutive logins
    if (prevLogin) {
      const diffDays = (Date.now() - new Date(prevLogin).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 8.0) {
        loginPrompt = 'monthly';
      } else if (diffDays > 1.5) {
        loginPrompt = 'weekly';
      }
    }

    // Update last login
    await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { userId: user.user_id, email: user.email, login_prompt: loginPrompt }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const formattedEmail = email.toLowerCase().trim();
    const checkRes = await db.query('SELECT * FROM users WHERE email = $1', [formattedEmail]);
    const user = checkRes.rows[0];

    if (!user) {
      // Return 200 to prevent email enumeration
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires_at = $2 WHERE email = $3',
      [resetToken, expiresAt, formattedEmail]
    );

    // If deployed on Vercel, the origin might not match localhost. We construct a dynamic link
    const origin = req.headers.origin || req.headers.referer || 'http://localhost:5000';
    // Clean up trailing slash
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    const resetLink = `${cleanOrigin}/?resetToken=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@entertainmentvalue.com',
      to: formattedEmail,
      subject: 'Value Engine: Password Reset Request',
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.`
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
    } else {
      console.log('EMAIL_USER or EMAIL_PASS not set. Logging reset link:', resetLink);
    }

    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Request password reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    const checkRes = await db.query('SELECT * FROM users WHERE reset_token = $1', [token]);
    const user = checkRes.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (new Date() > new Date(user.reset_token_expires_at)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL WHERE user_id = $2',
      [passwordHash, user.user_id]
    );

    res.json({ message: 'Password has been successfully reset' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
  const { name, cost, monthly_cost, billing_cycle, is_active } = req.body;
  
  const costVal = parseFloat(cost !== undefined ? cost : (monthly_cost !== undefined ? monthly_cost : 0));
  if (!name || costVal === undefined) {
    return res.status(400).json({ error: 'Name and cost are required' });
  }

  try {
    const subscriptionId = crypto.randomUUID();
    const cycleVal = billing_cycle || 'monthly';
    const monthlyCost = cycleVal === 'yearly' ? costVal / 12.0 : costVal;
    const isActiveVal = is_active !== false;
    
    await db.query(`
      INSERT INTO subscriptions (subscription_id, user_id, name, monthly_cost, cost, billing_cycle, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [subscriptionId, req.user.userId, name, monthlyCost, costVal, cycleVal, isActiveVal]);
    
    res.status(201).json({
      subscription_id: subscriptionId,
      user_id: req.user.userId,
      name,
      monthly_cost: monthlyCost,
      cost: costVal,
      billing_cycle: cycleVal,
      is_active: isActiveVal
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  const { name, cost, monthly_cost, billing_cycle, is_active } = req.body;
  const { id } = req.params;

  try {
    const subRes = await db.query('SELECT * FROM subscriptions WHERE subscription_id = $1 AND user_id = $2', [id, req.user.userId]);
    const sub = subRes.rows[0];
    if (!sub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const updatedName = name || sub.name;
    const updatedCost = cost !== undefined ? parseFloat(cost) : (monthly_cost !== undefined ? parseFloat(monthly_cost) : parseFloat(sub.cost || sub.monthly_cost || 0));
    const updatedCycle = billing_cycle || sub.billing_cycle || 'monthly';
    const updatedMonthlyCost = updatedCycle === 'yearly' ? updatedCost / 12.0 : updatedCost;
    const updatedActive = is_active !== undefined ? !!is_active : sub.is_active;

    await db.query(`
      UPDATE subscriptions 
      SET name = $1, cost = $2, billing_cycle = $3, monthly_cost = $4, is_active = $5
      WHERE subscription_id = $6 AND user_id = $7
    `, [updatedName, updatedCost, updatedCycle, updatedMonthlyCost, updatedActive, id, req.user.userId]);

    res.json({
      subscription_id: id,
      name: updatedName,
      cost: updatedCost,
      billing_cycle: updatedCycle,
      monthly_cost: updatedMonthlyCost,
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
    const placeholders = gameIds.map((_, i) => `$${i + 1}`).join(',');
    const resLogs = await db.query(`
      SELECT game_id, hours_played, logged_date 
      FROM play_logs 
      WHERE game_id IN (${placeholders})
      ORDER BY logged_date ASC
    `, gameIds);
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

      // 2. Sum up total hours played & get last played date
      const logsRes = await db.query('SELECT SUM(hours_played) as total, MAX(logged_date) as last_played FROM play_logs WHERE game_id = $1', [game.game_id]);
      const totalHours = logsRes.rows[0].total ? parseFloat(logsRes.rows[0].total) : 0.00;
      const lastPlayedAt = logsRes.rows[0].last_played ? logsRes.rows[0].last_played : null;

      // 3. Get qualitative profile from new qualitative_pillar_reviews table
      const qualRes = await db.query('SELECT pillar_name, rating, reason_text, was_expected, is_top_pillar FROM qualitative_pillar_reviews WHERE game_id = $1', [game.game_id]);
      
      const defaultPillars = {
        story: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        multiplayer: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        social: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        mechanics: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        graphics: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        challenge: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        relaxation: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false },
        pacing: { rating: 5, reason_text: '', was_expected: false, is_top_pillar: false }
      };

      const qualitativeObj = {};
      Object.keys(defaultPillars).forEach(k => { qualitativeObj[k] = { ...defaultPillars[k] }; });
      
      qualRes.rows.forEach(r => {
        qualitativeObj[r.pillar_name] = {
          rating: r.rating,
          reason_text: r.reason_text || '',
          was_expected: !!r.was_expected,
          is_top_pillar: !!r.is_top_pillar
        };
      });

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
      
      const overallHours = parseFloat(game.overall_hours || 0);
      const cph = overallHours > 0 ? (totalCost / overallHours) : null;

      return {
        ...game,
        base_cost: baseCost,
        addon_cost: addonCost,
        amortized_subscription_cost: amortizedSubscriptionCost,
        total_cost: totalCost,
        total_hours: overallHours,
        last_played_at: lastPlayedAt,
        cph,
        qualitative: qualitativeObj,
        categories
      };
    }));

    // Primary sort: last games played (most recent first)
    // Secondary sort: last games added (created_at most recent first)
    gamesWithMetrics.sort((a, b) => {
      const aPlayed = a.last_played_at ? new Date(a.last_played_at).getTime() : 0;
      const bPlayed = b.last_played_at ? new Date(b.last_played_at).getTime() : 0;

      if (aPlayed !== bPlayed) {
        return bPlayed - aPlayed; // Most recently played first
      }

      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bCreated - aCreated; // Most recently added second
    });

    res.json({
      games: gamesWithMetrics,
      subscription_waste: totalWaste,
      waste_breakdown: wasteBreakdown
    });
  } catch (err) {
    console.error('Get games metrics error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message, stack: String(err.stack) });
  }
});

app.post('/api/games', authenticateToken, async (req, res) => {
  const { title, acquisition_type, subscription_id, base_cost, qualitative, total_hours, unplayed, categories, play_mode, has_opinion } = req.body;
  
  if (!title || !acquisition_type) {
    return res.status(400).json({ error: 'Title and acquisition type are required' });
  }

  try {
    const gameId = crypto.randomUUID();
    const finalBaseCost = (acquisition_type === 'free' || acquisition_type === 'f2p') ? 0.00 : parseFloat(base_cost || 0);
    const finalSubId = acquisition_type === 'subscription' ? subscription_id : null;
    const initialHours = total_hours !== undefined ? parseFloat(total_hours) : 0.00;
    const finalUnplayed = initialHours > 0 ? false : (unplayed === true || unplayed === 'true');
    const initialStatus = finalUnplayed ? 'unplayed' : 'playing';
    const playMode = play_mode || 'single';
    const finalHasOpinion = has_opinion !== undefined ? (has_opinion === true || has_opinion === 'true') : !finalUnplayed;

    // 1. Insert Game
    await db.query(`
      INSERT INTO games (game_id, user_id, title, acquisition_type, subscription_id, base_cost, unplayed, status, overall_hours, play_mode, has_opinion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [gameId, req.user.userId, title, acquisition_type, finalSubId, finalBaseCost, finalUnplayed, initialStatus, initialHours, playMode, finalHasOpinion]);

    // 2. Insert Qualitative Pillar Reviews (using new deep dive schema)
    const q = qualitative || {};
    const defaultPillarsList = ['story', 'multiplayer', 'social', 'mechanics', 'graphics', 'challenge', 'relaxation', 'pacing'];
    for (const pillar of defaultPillarsList) {
      const pData = q[pillar] || {};
      const rating = pData.rating !== undefined && pData.rating !== null ? parseInt(pData.rating) : 5;
      const reason = pData.reason_text || '';
      const expected = !!pData.was_expected;
      const isTop = !!pData.is_top_pillar;
      
      await db.query(`
        INSERT INTO qualitative_pillar_reviews (review_id, game_id, pillar_name, rating, reason_text, was_expected, is_top_pillar)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [crypto.randomUUID(), gameId, pillar, rating, reason, expected, isTop]);
    }

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
      match_count: 0,
      has_opinion: finalHasOpinion
    });
  } catch (err) {
    console.error('Create game error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/games/:id', authenticateToken, async (req, res) => {
  const { title, acquisition_type, subscription_id, base_cost, qualitative, total_hours, unplayed, status, score_100, recommend, categories, play_mode, wont_play_again, has_opinion } = req.body;
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
    const updatedPlayMode = play_mode || game.play_mode || 'single';
    const updatedWontPlay = wont_play_again !== undefined ? (wont_play_again === true || wont_play_again === 'true') : !!game.wont_play_again;
    const finalHasOpinion = has_opinion !== undefined ? (has_opinion === true || has_opinion === 'true') : game.has_opinion;
    
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

    const updatedOverallHours = total_hours !== undefined ? parseFloat(total_hours) : game.overall_hours;

    // Dynamic Score_100 calculation based on pillars
    let computedScore100 = game.score_100;
    if (qualitative) {
      // First clear old pillar reviews
      await db.query('DELETE FROM qualitative_pillar_reviews WHERE game_id = $1', [id]);
      
      let totalWeightedScore = 0;
      let totalMaxWeight = 0;

      for (const [pillarName, pData] of Object.entries(qualitative)) {
        // rating can be null for N/A
        const rating = (pData.rating !== undefined && pData.rating !== null && pData.rating !== '') ? parseInt(pData.rating) : null;
        const reason = pData.reason_text || '';
        const expected = !!pData.was_expected;
        const isTop = !!pData.is_top_pillar;

        await db.query(`
          INSERT INTO qualitative_pillar_reviews (review_id, game_id, pillar_name, rating, reason_text, was_expected, is_top_pillar)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [crypto.randomUUID(), id, pillarName, rating, reason, expected, isTop]);

        if (rating !== null) {
          const weight = isTop ? 2 : 1;
          totalWeightedScore += (rating * weight);
          totalMaxWeight += (10 * weight);
        }
      }
      
      // Overwrite computed score
      if (totalMaxWeight > 0) {
        computedScore100 = Math.round((totalWeightedScore / totalMaxWeight) * 100);
      } else {
        computedScore100 = null;
      }
    } else {
      // If no qualitative data is explicitly passed, retain old score_100 if provided, else null.
      computedScore100 = score_100 !== undefined ? (score_100 === null || score_100 === '' ? null : parseInt(score_100)) : game.score_100;
    }

    await db.query(`
      UPDATE games 
      SET title = $1, acquisition_type = $2, subscription_id = $3, base_cost = $4,
          unplayed = $5, status = $6, score_100 = $7, recommend = $8, elo_rating = $9,
          overall_hours = $10, play_mode = $11, wont_play_again = $12, has_opinion = $13
      WHERE game_id = $14 AND user_id = $15
    `, [
      updatedTitle,
      updatedAcq,
      updatedSubId,
      updatedBaseCost,
      finalUnplayed,
      finalStatus,
      computedScore100,
      recommend !== undefined ? (recommend === null || recommend === '' ? null : (recommend === true || recommend === 'true')) : game.recommend,
      newElo,
      updatedOverallHours,
      updatedPlayMode,
      updatedWontPlay,
      finalHasOpinion,
      id,
      req.user.userId
    ]);

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
  const { hours_played, logged_date, addToTotal, is_rotation_boost } = req.body;

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
    const hours = parseFloat(hours_played);

    await db.query(`
      INSERT INTO play_logs (log_id, game_id, hours_played, logged_date)
      VALUES ($1, $2, $3, $4)
    `, [logId, id, hours, formattedDate]);

    if (addToTotal === true || addToTotal === 'true') {
      await db.query(`
        UPDATE games 
        SET overall_hours = overall_hours + $1, unplayed = 0
        WHERE game_id = $2
      `, [hours, id]);
    }

    const isRotationBoost = is_rotation_boost === true || is_rotation_boost === 'true';
    if (isRotationBoost) {
      await db.query(`
        UPDATE games 
        SET elo_rating = elo_rating + 10 
        WHERE game_id = $1
      `, [id]);
    }

    res.status(201).json({
      log_id: logId,
      game_id: id,
      hours_played: hours,
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

const COMPARISON_PROMPTS = [
  { id: 'general', text: 'Which experience do you prefer overall?' },
  { id: 'right_now', text: 'Which game would you rather play right now?' },
  { id: 'relax', text: 'Which game would you rather play to relax?' },
  { id: 'social', text: 'Which game would you rather play with friends?' },
  { id: 'solo', text: 'Which game would you rather play solo?' },
  { id: 'story', text: 'Which game has the better story/narrative?' },
  { id: 'mechanics', text: 'Which game has the better gameplay mechanics?' },
  { id: 'graphics', text: 'Which game has the more impressive graphics/visuals?' },
  { id: 'challenge', text: 'Which game has the more satisfying challenge/difficulty?' },
  { id: 'pacing', text: 'Which game has the more satisfying pacing/flow?' },
  { id: 'engagement', text: 'Which game has the more engaging hook/retention?' },
  { id: 'stress', text: 'Which game has more intense/stressful moments?' }
];

app.get('/api/pairwise/match', authenticateToken, async (req, res) => {
  try {
    let randomPrompt = COMPARISON_PROMPTS[Math.floor(Math.random() * COMPARISON_PROMPTS.length)];
    let modeFilter = '';

    if (randomPrompt.id === 'social') {
      modeFilter = "AND play_mode IN ('multi', 'both')";
    } else if (randomPrompt.id === 'solo') {
      modeFilter = "AND play_mode IN ('single', 'both')";
    }

    let gamesRes = await db.query(`
      SELECT game_id, title, elo_rating, match_count, play_mode 
      FROM games 
      WHERE user_id = $1 
        AND unplayed = FALSE
        AND overall_hours > 0
        AND has_opinion = TRUE
        ${modeFilter}
    `, [req.user.userId]);

    // Fallback: If less than 2 games match this specific single/multiplayer criteria,
    // fall back to a general comparison query with all played games.
    if (gamesRes.rows.length < 2 && modeFilter !== '') {
      randomPrompt = COMPARISON_PROMPTS.find(p => p.id === 'general');
      gamesRes = await db.query(`
        SELECT game_id, title, elo_rating, match_count, play_mode 
        FROM games 
        WHERE user_id = $1 
          AND unplayed = FALSE
          AND overall_hours > 0
          AND has_opinion = TRUE
      `, [req.user.userId]);
    }

    const games = gamesRes.rows;
    
    if (games.length < 2) {
      return res.status(400).json({ error: 'You need at least 2 played games in your library to start comparison matches.' });
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

    res.json({ gameA, gameB, prompt: randomPrompt });
  } catch (err) {
    console.error('Matchmaking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pairwise/match', authenticateToken, async (req, res) => {
  const { game_a_id, game_b_id, chosen_game_id, prompt_type, reason_pillar } = req.body;

  if (!game_a_id || !game_b_id || !chosen_game_id) {
    return res.status(400).json({ error: 'game_a_id, game_b_id, and chosen_game_id are required' });
  }

  if (chosen_game_id !== game_a_id && chosen_game_id !== game_b_id && chosen_game_id !== 'neither') {
    return res.status(400).json({ error: 'Chosen game must be Game A, Game B, or neither' });
  }

  const promptType = prompt_type || 'general';

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

    // Resolve K-factor based on prompt type importance
    let K = 8;
    if (promptType === 'general') K = 32;
    else if (promptType === 'right_now') K = 48; // Mood is highly dynamic
    else if (promptType === 'relax' || promptType === 'social' || promptType === 'solo') K = 16;

    const SA = chosen_game_id === game_a_id ? 1 : 0;
    const SB = chosen_game_id === game_b_id ? 1 : 0;

    const newRatingA = Math.round(ratingA + K * (SA - EA));
    const newRatingB = Math.round(ratingB + K * (SB - EB));

    // 3. Log match
    const matchId = crypto.randomUUID();
    await db.query(`
      INSERT INTO pairwise_matches (match_id, user_id, game_a_id, game_b_id, chosen_game_id, prompt_type)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [matchId, req.user.userId, game_a_id, game_b_id, chosen_game_id, promptType]);

    // 4. Update qualitative profiles dynamically
    if (chosen_game_id !== 'neither') {
      const chosenId = chosen_game_id;
      const unchosenId = chosen_game_id === game_a_id ? game_b_id : game_a_id;

      const columnMapping = {
        relax: ['relaxation'],
        social: ['multiplayer', 'social'],
        story: ['story'],
        mechanics: ['mechanics'],
        graphics: ['graphics'],
        challenge: ['challenge'],
        pacing: ['pacing'],
        engagement: ['engagement'],
        stress: ['stress_intensity']
      };

      if (promptType === 'solo') {
        // Winner: solo-friendly (high relaxation/story, low multiplayer/social)
        await db.query(`
          UPDATE qualitative_profiles 
          SET relaxation = MIN(10.0, COALESCE(relaxation, 5.0) + 0.5),
              story = MIN(10.0, COALESCE(story, 5.0) + 0.5),
              multiplayer = MAX(0.0, COALESCE(multiplayer, 5.0) - 0.5),
              social = MAX(0.0, COALESCE(social, 5.0) - 0.5)
          WHERE game_id = $1
        `, [chosenId]);
        // Loser: less solo-friendly (low relaxation/story, high multiplayer/social)
        await db.query(`
          UPDATE qualitative_profiles 
          SET relaxation = MAX(0.0, COALESCE(relaxation, 5.0) - 0.5),
              story = MAX(0.0, COALESCE(story, 5.0) - 0.5),
              multiplayer = MIN(10.0, COALESCE(multiplayer, 5.0) + 0.5),
              social = MIN(10.0, COALESCE(social, 5.0) + 0.5)
          WHERE game_id = $1
        `, [unchosenId]);
      } else if (columnMapping[promptType]) {
        const cols = columnMapping[promptType];
        for (const col of cols) {
          await db.query(`UPDATE qualitative_profiles SET ${col} = MIN(10.0, COALESCE(${col}, 5.0) + 0.5) WHERE game_id = $1`, [chosenId]);
          await db.query(`UPDATE qualitative_profiles SET ${col} = MAX(0.0, COALESCE(${col}, 5.0) - 0.5) WHERE game_id = $1`, [unchosenId]);
        }
      }

      // Apply specific reason pillar boost from generic matchup choice
      const validPillars = ['story', 'mechanics', 'graphics', 'challenge', 'pacing', 'engagement', 'relaxation', 'social', 'multiplayer', 'stress_intensity'];
      if (reason_pillar && validPillars.includes(reason_pillar)) {
        await db.query(`UPDATE qualitative_profiles SET ${reason_pillar} = MIN(10.0, COALESCE(${reason_pillar}, 5.0) + 1.0) WHERE game_id = $1`, [chosenId]);
        await db.query(`UPDATE qualitative_profiles SET ${reason_pillar} = MAX(0.0, COALESCE(${reason_pillar}, 5.0) - 1.0) WHERE game_id = $1`, [unchosenId]);
      }
    }

    // 5. Update games Elo
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

app.post('/api/games/linear-sort', authenticateToken, async (req, res) => {
  const { game_id, insert_index } = req.body;

  if (!game_id || insert_index === undefined) {
    return res.status(400).json({ error: 'game_id and insert_index are required' });
  }

  try {
    // 1. Fetch the target game to make sure it exists for this user
    const gameRes = await db.query('SELECT * FROM games WHERE game_id = $1 AND user_id = $2', [game_id, req.user.userId]);
    const targetGame = gameRes.rows[0];
    if (!targetGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // 2. Fetch all currently sorted games in the Long Line
    const sortedRes = await db.query(
      'SELECT game_id, elo_rating, match_count, title FROM games WHERE user_id = $1 AND linear_position IS NOT NULL ORDER BY linear_position ASC',
      [req.user.userId]
    );
    let sortedGames = sortedRes.rows;

    // Remove the target game from the sorted list if it is already there (moving case)
    const existingIndex = sortedGames.findIndex(g => g.game_id === game_id);
    if (existingIndex !== -1) {
      sortedGames.splice(existingIndex, 1);
    }

    // 3. Splice targetGame into sortedGames at insert_index
    sortedGames.splice(insert_index, 0, targetGame);

    // 4. Update linear_position database values for all elements
    for (let idx = 0; idx < sortedGames.length; idx++) {
      await db.query(
        'UPDATE games SET linear_position = $1 WHERE game_id = $2 AND user_id = $3',
        [idx, sortedGames[idx].game_id, req.user.userId]
      );
    }

    // 5. Bulk Elo updates across adjacent stack nodes
    const K = 32;
    let newEloTarget = targetGame.elo_rating || 1200;

    // Check frontGame (index insert_index - 1)
    if (insert_index > 0) {
      const frontGame = sortedGames[insert_index - 1];
      const ratingA = frontGame.elo_rating || 1200; // winner
      const ratingB = newEloTarget; // loser
      
      const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
      const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
      
      const newRatingA = Math.round(ratingA + K * (1 - EA));
      newEloTarget = Math.round(ratingB + K * (0 - EB));

      // Update frontGame ELO
      await db.query(
        'UPDATE games SET elo_rating = $1, match_count = match_count + 1 WHERE game_id = $2 AND user_id = $3',
        [newRatingA, frontGame.game_id, req.user.userId]
      );

      // Log match
      await db.query(`
        INSERT INTO pairwise_matches (match_id, user_id, exercise_type, game_a_id, game_b_id, chosen_game_id)
        VALUES ($1, $2, 'long_line', $3, $4, $5)
      `, [crypto.randomUUID(), req.user.userId, frontGame.game_id, game_id, frontGame.game_id]);
    }

    // Check behindGame (index insert_index + 1)
    if (insert_index + 1 < sortedGames.length) {
      const behindGame = sortedGames[insert_index + 1];
      const ratingA = newEloTarget; // winner
      const ratingB = behindGame.elo_rating || 1200; // loser
      
      const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
      const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
      
      newEloTarget = Math.round(ratingA + K * (1 - EA));
      const newRatingB = Math.round(ratingB + K * (0 - EB));

      // Update behindGame ELO
      await db.query(
        'UPDATE games SET elo_rating = $1, match_count = match_count + 1 WHERE game_id = $2 AND user_id = $3',
        [newRatingB, behindGame.game_id, req.user.userId]
      );

      // Log match
      await db.query(`
        INSERT INTO pairwise_matches (match_id, user_id, exercise_type, game_a_id, game_b_id, chosen_game_id)
        VALUES ($1, $2, 'long_line', $3, $4, $5)
      `, [crypto.randomUUID(), req.user.userId, game_id, behindGame.game_id, game_id]);
    }

    // Update target game ELO
    await db.query(
      'UPDATE games SET elo_rating = $1, match_count = match_count + $2 WHERE game_id = $3 AND user_id = $4',
      [
        newEloTarget,
        (insert_index > 0 ? 1 : 0) + (insert_index + 1 < sortedGames.length ? 1 : 0),
        game_id,
        req.user.userId
      ]
    );

    res.json({ success: true, new_elo: newEloTarget });
  } catch (err) {
    console.error('Linear sort error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pairwise/sort', authenticateToken, async (req, res) => {
  const { sorted_game_ids, recommendations } = req.body;

  if (!sorted_game_ids || !Array.isArray(sorted_game_ids) || sorted_game_ids.length < 2) {
    return res.status(400).json({ error: 'sorted_game_ids must be an array of at least 2 game IDs' });
  }

  try {
    // 1. Update recommendations if provided
    if (recommendations && typeof recommendations === 'object') {
      for (const [gameId, recValue] of Object.entries(recommendations)) {
        await db.query(`
          UPDATE games 
          SET recommend = $1 
          WHERE game_id = $2 AND user_id = $3
        `, [recValue === null || recValue === '' ? null : (recValue === true || recValue === 'true'), gameId, req.user.userId]);
      }
    }

    const updatedRatings = {};

    // 2. Process adjacent preferences: G[i] beats G[i+1]
    for (let i = 0; i < sorted_game_ids.length - 1; i++) {
      const winnerId = sorted_game_ids[i];
      const loserId = sorted_game_ids[i + 1];

      // Fetch current Elos
      const resWinner = await db.query('SELECT elo_rating, match_count FROM games WHERE game_id = $1 AND user_id = $2', [winnerId, req.user.userId]);
      const resLoser = await db.query('SELECT elo_rating, match_count FROM games WHERE game_id = $1 AND user_id = $2', [loserId, req.user.userId]);

      if (resWinner.rows.length > 0 && resLoser.rows.length > 0) {
        const ratingWinner = resWinner.rows[0].elo_rating;
        const ratingLoser = resLoser.rows[0].elo_rating;

        // Calculate ELO expectations
        const EW = 1 / (1 + Math.pow(10, (ratingLoser - ratingWinner) / 400));
        const EL = 1 / (1 + Math.pow(10, (ratingWinner - ratingLoser) / 400));

        const K = 16; // Moderate weight for card sorting adjacent elements

        const newRatingWinner = Math.round(ratingWinner + K * (1 - EW));
        const newRatingLoser = Math.round(ratingLoser + K * (0 - EL));

        // Log match
        const matchId = crypto.randomUUID();
        await db.query(`
          INSERT INTO pairwise_matches (match_id, user_id, game_a_id, game_b_id, chosen_game_id, prompt_type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [matchId, req.user.userId, winnerId, loserId, winnerId, 'card_sort']);

        // Update games Elo
        await db.query(`
          UPDATE games 
          SET elo_rating = $1, match_count = match_count + 1 
          WHERE game_id = $2
        `, [newRatingWinner, winnerId]);

        await db.query(`
          UPDATE games 
          SET elo_rating = $1, match_count = match_count + 1 
          WHERE game_id = $2
        `, [newRatingLoser, loserId]);

        updatedRatings[winnerId] = newRatingWinner;
        updatedRatings[loserId] = newRatingLoser;
      }
    }

    res.json({ success: true, updatedRatings });
  } catch (err) {
    console.error('Card sorting record error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/moods', authenticateToken, async (req, res) => {
  const { mood_type } = req.body;
  if (!mood_type) {
    return res.status(400).json({ error: 'mood_type is required' });
  }

  try {
    const moodId = crypto.randomUUID();
    await db.query(`
      INSERT INTO player_moods (mood_id, user_id, mood_type)
      VALUES ($1, $2, $3)
    `, [moodId, req.user.userId, mood_type]);

    res.status(201).json({ success: true, mood_id: moodId, mood_type });
  } catch (err) {
    console.error('Record player mood error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/moods/timeline', authenticateToken, async (req, res) => {
  try {
    // 1. Fetch all play logs joined with qualitative profiles
    const logsRes = await db.query(`
      SELECT l.hours_played, l.logged_date, q.story, q.multiplayer, q.mechanics, q.graphics, q.challenge, q.relaxation, q.pacing 
      FROM play_logs l 
      JOIN games g ON l.game_id = g.game_id 
      JOIN qualitative_profiles q ON g.game_id = q.game_id 
      WHERE g.user_id = $1 
      ORDER BY l.logged_date ASC
    `, [req.user.userId]);

    const logs = logsRes.rows;
    if (logs.length === 0) {
      return res.json([]);
    }

    // Helper to calculate the start of week for YYYY-MM-DD
    const getStartOfWeek = (dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(d.setDate(diff));
      return startOfWeek.toISOString().substring(0, 10);
    };

    // Group logs by week
    const weeklyData = {};
    for (const log of logs) {
      const week = getStartOfWeek(log.logged_date);
      if (!weeklyData[week]) {
        weeklyData[week] = {
          week,
          total_hours: 0,
          story_sum: 0,
          multiplayer_sum: 0,
          mechanics_sum: 0,
          graphics_sum: 0,
          challenge_sum: 0,
          relaxation_sum: 0,
          pacing_sum: 0
        };
      }

      const hours = parseFloat(log.hours_played);
      weeklyData[week].total_hours += hours;
      weeklyData[week].story_sum += (log.story ?? 5) * hours;
      weeklyData[week].multiplayer_sum += (log.multiplayer ?? 5) * hours;
      weeklyData[week].mechanics_sum += (log.mechanics ?? 5) * hours;
      weeklyData[week].graphics_sum += (log.graphics ?? 5) * hours;
      weeklyData[week].challenge_sum += (log.challenge ?? 5) * hours;
      weeklyData[week].relaxation_sum += (log.relaxation ?? 5) * hours;
      weeklyData[week].pacing_sum += (log.pacing ?? 5) * hours;
    }

    // Compute weighted averages
    const timeline = Object.values(weeklyData).map(w => {
      const total = w.total_hours || 1.0;
      return {
        week: w.week,
        hours: w.total_hours,
        story: Math.round((w.story_sum / total) * 10) / 10,
        multiplayer: Math.round((w.multiplayer_sum / total) * 10) / 10,
        mechanics: Math.round((w.mechanics_sum / total) * 10) / 10,
        graphics: Math.round((w.graphics_sum / total) * 10) / 10,
        challenge: Math.round((w.challenge_sum / total) * 10) / 10,
        relaxation: Math.round((w.relaxation_sum / total) * 10) / 10,
        pacing: Math.round((w.pacing_sum / total) * 10) / 10
      };
    }).sort((a, b) => a.week.localeCompare(b.week));

    res.json(timeline);
  } catch (err) {
    console.error('Get moods timeline error:', err);
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

// --- MOOD & INTENT SERVICES ---

app.post('/api/moods/log', authenticateToken, async (req, res) => {
  const { mood_tag, intended_play_mode, notes } = req.body;
  if (!mood_tag) return res.status(400).json({ error: 'Mood tag is required' });
  
  try {
    const moodLogId = crypto.randomUUID();
    await db.query(
      'INSERT INTO player_mood_logs (mood_log_id, user_id, mood_tag, intended_play_mode, notes) VALUES ($1, $2, $3, $4, $5)',
      [moodLogId, req.user.userId, mood_tag, intended_play_mode || null, notes || null]
    );
    res.json({ message: 'Mood logged successfully', mood_log_id: moodLogId });
  } catch (err) {
    console.error('Mood log error:', err);
    res.status(500).json({ error: 'Failed to log mood' });
  }
});

app.get('/api/moods/analytics', authenticateToken, async (req, res) => {
  try {
    const queryRes = await db.query(
      `SELECT mood_tag, COUNT(*) as count 
       FROM player_mood_logs 
       WHERE user_id = $1 
       GROUP BY mood_tag 
       ORDER BY count DESC`,
      [req.user.userId]
    );
    res.json(queryRes.rows);
  } catch (err) {
    console.error('Mood analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve mood analytics' });
  }
});

// --- CHURN DIAGNOSTICS SERVICES ---

app.get('/api/churn/candidates', authenticateToken, async (req, res) => {
  // Finds games played recently but haven't been played in a while
  // Simplified logic for MVP: just get all games not played in last 14 days that have > 2 hours.
  try {
    const queryRes = await db.query(
      `SELECT g.game_id, g.title, MAX(p.logged_date) as last_played
       FROM games g
       JOIN play_logs p ON g.game_id = p.game_id
       WHERE g.user_id = $1
       GROUP BY g.game_id, g.title
       HAVING (julianday('now') - julianday(MAX(p.logged_date))) > 14
       AND SUM(p.hours_played) > 2
       ORDER BY last_played DESC
       LIMIT 5`,
       [req.user.userId]
    );
    res.json(queryRes.rows);
  } catch (err) {
    console.error('Churn candidates error:', err);
    res.status(500).json({ error: 'Failed to get churn candidates' });
  }
});

app.post('/api/churn/log', authenticateToken, async (req, res) => {
  const { from_game_id, to_game_id, reason_category, comments } = req.body;
  if (!from_game_id || !reason_category) return res.status(400).json({ error: 'from_game_id and reason_category required' });
  
  try {
    const churnId = crypto.randomUUID();
    await db.query(
      `INSERT INTO game_churn_events (churn_id, user_id, from_game_id, to_game_id, reason_category, comments)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [churnId, req.user.userId, from_game_id, to_game_id || null, reason_category, comments || null]
    );
    res.json({ message: 'Churn event logged', churn_id: churnId });
  } catch (err) {
    console.error('Churn log error:', err);
    res.status(500).json({ error: 'Failed to log churn event' });
  }
});

// --- RECOMMENDATION ENGINE SERVICES ---

app.get('/api/recommendations/library', authenticateToken, async (req, res) => {
  const { mood, mode } = req.query;
  try {
    let baseQuery = `
      SELECT g.game_id, g.title, g.cover_image_url, q.story, q.multiplayer, q.challenge, q.relaxation, q.value_satisfaction
      FROM games g
      LEFT JOIN qualitative_profiles q ON g.game_id = q.game_id
      WHERE g.user_id = $1 AND g.game_status IN ('Backlog', 'Playing')
    `;
    const params = [req.user.userId];
    
    if (mode === 'Single-player') {
      baseQuery += ` ORDER BY COALESCE(q.story, 5) DESC, COALESCE(q.multiplayer, 5) ASC LIMIT 10`;
    } else if (mode === 'Multi-player') {
      baseQuery += ` ORDER BY COALESCE(q.multiplayer, 5) DESC LIMIT 10`;
    } else if (mood === 'Relaxed' || mood === 'Cozy') {
      baseQuery += ` ORDER BY COALESCE(q.relaxation, 5) DESC LIMIT 10`;
    } else if (mood === 'Challenged' || mood === 'Competitive') {
      baseQuery += ` ORDER BY COALESCE(q.challenge, 5) DESC LIMIT 10`;
    } else {
      // Default: prioritize highest overall qualitative score
      baseQuery += ` ORDER BY (COALESCE(q.story,5) + COALESCE(q.mechanics,5) + COALESCE(q.engagement,5)) DESC LIMIT 10`;
    }
    
    const queryRes = await db.query(baseQuery, params);
    res.json(queryRes.rows);
  } catch (err) {
    console.error('Library recommendations error:', err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

app.get('/api/recommendations/external', authenticateToken, async (req, res) => {
  const { tags, mood } = req.query;
  try {
    // We allow passing of a RAWG API KEY in ENV
    if (!process.env.RAWG_API_KEY) {
      return res.status(500).json({ error: 'RAWG API key missing in environment' });
    }
    
    let rawgUrl = `https://api.rawg.io/api/games?key=${process.env.RAWG_API_KEY}&page_size=5&ordering=-rating`;
    
    if (tags) {
      rawgUrl += `&tags=${encodeURIComponent(tags.toLowerCase())}`;
    }
    if (mood === 'Relaxed' || mood === 'Cozy') {
      rawgUrl += `&tags=relaxing,atmospheric`;
    } else if (mood === 'Challenged' || mood === 'Competitive') {
      rawgUrl += `&tags=difficult,souls-like`;
    }

    const rawgRes = await fetch(rawgUrl);
    if (!rawgRes.ok) throw new Error('RAWG API error');
    const data = await rawgRes.json();
    
    const formatted = data.results.map(game => ({
      game_id: `rawg_${game.id}`,
      title: game.name,
      cover_image_url: game.background_image,
      rating: game.rating,
      released: game.released,
      genres: game.genres ? game.genres.map(g => g.name).join(', ') : ''
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error('External recommendations error:', err);
    res.status(500).json({ error: 'Failed to get external recommendations' });
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
