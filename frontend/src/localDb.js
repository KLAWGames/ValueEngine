// localDb.js - Client-Side Local Database Emulator using localStorage
// Emulates PostgreSQL/SQLite tables and executes business logic (Amortization, ELO matchmaking, etc.) locally.

const SEED_CATEGORIES = [
  'RPG', 'Action', 'Adventure', 'Shooter', 'Platformer', 
  'Roguelike', 'Simulation', 'Strategy', 'Puzzle', 'Survival', 
  'Sports', 'Fighting', 'Metroidvania', 'Indie', 'MMO', 
  'Soulslike', 'Horror', 'Sandbox', 'Card & Board', 'Racing'
];

const COMPARISON_PROMPTS = [
  { id: 'general', text: 'Which game did you enjoy playing more overall?' },
  { id: 'right_now', text: 'Which game would you rather play right now?' },
  { id: 'relax', text: 'Which game is better for relaxing/unwinding?' },
  { id: 'story', text: 'Which game has the better story/narrative?' },
  { id: 'social', text: 'Which game has the better social/multiplayer experience?' },
  { id: 'solo', text: 'Which game has the better solo/campaign experience?' },
  { id: 'mechanics', text: 'Which game has the better gameplay mechanics?' },
  { id: 'graphics', text: 'Which game has the more impressive graphics/visuals?' },
  { id: 'challenge', text: 'Which game has the more satisfying challenge/difficulty?' },
  { id: 'pacing', text: 'Which game has the more satisfying pacing/flow?' },
  { id: 'engagement', text: 'Which game has the more engaging hook/retention?' },
  { id: 'stress', text: 'Which game has more intense/stressful moments?' }
];

// Helper functions for reading/writing localStorage
const getTable = (name) => {
  const data = localStorage.getItem(`ldb_${name}`);
  return data ? JSON.parse(data) : [];
};

const saveTable = (name, data) => {
  localStorage.setItem(`ldb_${name}`, JSON.stringify(data));
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Database Initialization
export const initDb = () => {
  // Seed categories
  const categories = getTable('categories');
  if (categories.length === 0) {
    const seeded = SEED_CATEGORIES.map(name => ({
      category_id: generateUUID(),
      name
    }));
    saveTable('categories', seeded);
  }

  // Seed default user if none exists
  const users = getTable('users');
  if (users.length === 0) {
    saveTable('users', [{
      user_id: 'local-default-user-id',
      email: 'local@user.com',
      password_hash: 'mocked',
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    }]);
  }
};

// Auth Emulation
export const register = (email, password) => {
  initDb();
  const users = getTable('users');
  const cleanEmail = email.toLowerCase().trim();
  
  if (users.some(u => u.email === cleanEmail)) {
    throw new Error('Email already registered');
  }

  const userId = generateUUID();
  users.push({
    user_id: userId,
    email: cleanEmail,
    password_hash: 'mocked',
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString()
  });
  saveTable('users', users);

  return {
    token: `mock-jwt-token-for-${userId}`,
    user: { userId, email: cleanEmail, login_prompt: 'daily' }
  };
};

export const login = (email, password) => {
  initDb();
  const users = getTable('users');
  const cleanEmail = email.toLowerCase().trim();
  const user = users.find(u => u.email === cleanEmail);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Recency prompt calculation
  const prevLogin = user.last_login_at;
  let loginPrompt = 'daily';
  if (prevLogin) {
    const diffDays = (Date.now() - new Date(prevLogin).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 8.0) {
      loginPrompt = 'monthly';
    } else if (diffDays > 1.5) {
      loginPrompt = 'weekly';
    }
  }

  user.last_login_at = new Date().toISOString();
  saveTable('users', users);

  return {
    token: `mock-jwt-token-for-${user.user_id}`,
    user: { userId: user.user_id, email: cleanEmail, login_prompt: loginPrompt }
  };
};

// Subscriptions CRUD
export const getSubscriptions = () => {
  return getTable('subscriptions');
};

export const createSubscription = (subData) => {
  const subs = getTable('subscriptions');
  const newSub = {
    subscription_id: generateUUID(),
    name: subData.name,
    monthly_cost: parseFloat(subData.monthly_cost || 0),
    cost: parseFloat(subData.cost || subData.monthly_cost || 0),
    is_active: subData.is_active !== undefined ? subData.is_active : true,
    billing_cycle: subData.billing_cycle || 'monthly'
  };
  subs.push(newSub);
  saveTable('subscriptions', subs);
  return newSub;
};

export const updateSubscription = (id, subData) => {
  const subs = getTable('subscriptions');
  const idx = subs.findIndex(s => s.subscription_id === id);
  if (idx === -1) throw new Error('Subscription not found');

  subs[idx] = {
    ...subs[idx],
    name: subData.name || subs[idx].name,
    monthly_cost: subData.monthly_cost !== undefined ? parseFloat(subData.monthly_cost) : subs[idx].monthly_cost,
    cost: subData.cost !== undefined ? parseFloat(subData.cost) : subs[idx].cost,
    is_active: subData.is_active !== undefined ? subData.is_active : subs[idx].is_active,
    billing_cycle: subData.billing_cycle || subs[idx].billing_cycle
  };
  saveTable('subscriptions', subs);
  return subs[idx];
};

export const deleteSubscription = (id) => {
  const subs = getTable('subscriptions');
  const filtered = subs.filter(s => s.subscription_id !== id);
  saveTable('subscriptions', filtered);

  // Unlink games
  const games = getTable('games');
  games.forEach(g => {
    if (g.subscription_id === id) {
      g.subscription_id = null;
    }
  });
  saveTable('games', games);
  return { success: true };
};

// Amortization Calculations
export const getSubscriptionAmortization = () => {
  const subs = getTable('subscriptions');
  const games = getTable('games');
  const logs = getTable('play_logs');

  const gameAmortized = {};
  let totalWaste = 0;
  const wasteBreakdown = [];

  for (const sub of subs) {
    const subGames = games.filter(g => g.subscription_id === sub.subscription_id);
    const subCost = parseFloat(sub.monthly_cost || sub.cost || 0);

    if (subGames.length === 0) {
      if (sub.is_active) {
        totalWaste += subCost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: subCost,
          reason: 'No games associated'
        });
      }
      continue;
    }

    const subGameIds = subGames.map(g => g.game_id);
    const subLogs = logs
      .filter(l => subGameIds.includes(l.game_id))
      .sort((a, b) => new Date(a.logged_date) - new Date(b.logged_date));

    if (subLogs.length === 0) {
      if (sub.is_active) {
        totalWaste += subCost;
        wasteBreakdown.push({
          subscription_name: sub.name,
          cost: subCost,
          reason: 'No play hours logged yet'
        });
      }
      continue;
    }

    // Group logs by month
    const logsByMonth = {};
    subLogs.forEach(log => {
      const monthStr = log.logged_date.substring(0, 7); // "YYYY-MM"
      if (!logsByMonth[monthStr]) logsByMonth[monthStr] = [];
      logsByMonth[monthStr].push(log);
    });

    // Determine billing periods
    const earliestDate = new Date(subLogs[0].logged_date);
    const latestDate = new Date(subLogs[subLogs.length - 1].logged_date);

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

    // Allocate costs
    billingMonths.forEach(mStr => {
      const monthLogs = logsByMonth[mStr] || [];
      const totalHoursInMonth = monthLogs.reduce((sum, l) => sum + parseFloat(l.hours_played), 0);

      if (totalHoursInMonth > 0) {
        monthLogs.forEach(log => {
          const ratio = parseFloat(log.hours_played) / totalHoursInMonth;
          const allocated = subCost * ratio;
          gameAmortized[log.game_id] = (gameAmortized[log.game_id] || 0) + allocated;
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

// Games CRUD
export const getGames = () => {
  const games = getTable('games');
  const purchases = getTable('game_purchases');
  const categories = getTable('categories');
  const gameCategories = getTable('game_categories');
  const subs = getTable('subscriptions');
  const qualitativeProfiles = getTable('qualitative_profiles');

  const { gameAmortized, totalWaste, wasteBreakdown } = getSubscriptionAmortization();

  const gamesWithMetrics = games.map(game => {
    // DLC cost
    const gamePurchases = purchases.filter(p => p.game_id === game.game_id);
    const addonCost = gamePurchases.reduce((sum, p) => sum + parseFloat(p.cost), 0);

    // Qualitative profile
    const profile = qualitativeProfiles.find(qp => qp.game_id === game.game_id);
    const qualitative = profile ? {
      story: profile.story ?? 5,
      multiplayer: profile.multiplayer ?? 5,
      mechanics: profile.mechanics ?? 5,
      graphics: profile.graphics ?? 5,
      challenge: profile.challenge ?? 5,
      relaxation: profile.relaxation ?? 5,
      pacing: profile.pacing ?? 5,
      engagement: profile.engagement ?? 5,
      social: profile.social ?? 5,
      stress_intensity: profile.stress_intensity ?? 5
    } : {
      story: 5, multiplayer: 5, mechanics: 5, graphics: 5, challenge: 5,
      relaxation: 5, pacing: 5, engagement: 5, social: 5, stress_intensity: 5
    };

    // Categories
    const taggedCatIds = gameCategories
      .filter(gc => gc.game_id === game.game_id)
      .map(gc => gc.category_id);
    const gameCats = categories
      .filter(c => taggedCatIds.includes(c.category_id))
      .map(c => c.name);

    // Costs
    const sub = subs.find(s => s.subscription_id === game.subscription_id);
    const baseCost = game.acquisition_type === 'free' || game.acquisition_type === 'f2p' ? 0.00 : parseFloat(game.base_cost || 0);
    const amortizedSubscriptionCost = game.acquisition_type === 'subscription' ? (gameAmortized[game.game_id] || 0.00) : 0.00;
    const totalCost = baseCost + addonCost + amortizedSubscriptionCost;

    const overallHours = parseFloat(game.overall_hours || 0);
    const cph = overallHours > 0 ? (totalCost / overallHours) : null;

    return {
      ...game,
      subscription_name: sub ? sub.name : null,
      base_cost: baseCost,
      addon_cost: addonCost,
      amortized_subscription_cost: amortizedSubscriptionCost,
      total_cost: totalCost,
      total_hours: overallHours,
      cph,
      qualitative,
      categories: gameCats
    };
  });

  return {
    games: gamesWithMetrics,
    subscription_waste: totalWaste,
    waste_breakdown: wasteBreakdown
  };
};

export const createGame = (gameData) => {
  const games = getTable('games');
  const qProfiles = getTable('qualitative_profiles');
  const gameCategories = getTable('game_categories');
  const categories = getTable('categories');

  const gameId = generateUUID();
  const baseCost = (gameData.acquisition_type === 'free' || gameData.acquisition_type === 'f2p') ? 0.00 : parseFloat(gameData.base_cost || 0);
  const unplayed = gameData.unplayed === true;
  const status = unplayed ? 'unplayed' : 'playing';
  const hasOpinion = gameData.has_opinion !== undefined ? gameData.has_opinion === true : !unplayed;

  const newGame = {
    game_id: gameId,
    user_id: 'local-default-user-id',
    title: gameData.title,
    acquisition_type: gameData.acquisition_type,
    subscription_id: gameData.acquisition_type === 'subscription' ? gameData.subscription_id : null,
    base_cost: baseCost,
    elo_rating: 1200,
    match_count: 0,
    created_at: new Date().toISOString(),
    status,
    score_100: null,
    recommend: null,
    unplayed,
    overall_hours: parseFloat(gameData.total_hours || 0),
    play_mode: gameData.play_mode || 'single',
    wont_play_again: false,
    linear_position: null,
    has_opinion: hasOpinion
  };

  games.push(newGame);
  saveTable('games', games);

  // qualitative profile
  const q = gameData.qualitative || {};
  const profile = {
    profile_id: generateUUID(),
    game_id: gameId,
    story: parseInt(q.story ?? 5),
    multiplayer: parseInt(q.multiplayer ?? 5),
    mechanics: parseInt(q.mechanics ?? 5),
    graphics: parseInt(q.graphics ?? 5),
    challenge: parseInt(q.challenge ?? 5),
    relaxation: parseInt(q.relaxation ?? 5),
    pacing: parseInt(q.pacing ?? 5),
    engagement: parseInt(q.engagement ?? 5),
    social: parseInt(q.social ?? 5),
    stress_intensity: parseInt(q.stress_intensity ?? 5)
  };
  qProfiles.push(profile);
  saveTable('qualitative_profiles', qProfiles);

  // Category tags
  if (gameData.categories && Array.isArray(gameData.categories)) {
    gameData.categories.forEach(catName => {
      const cleanCat = catName.trim();
      if (!cleanCat) return;

      let cat = categories.find(c => c.name.toLowerCase() === cleanCat.toLowerCase());
      if (!cat) {
        cat = { category_id: generateUUID(), name: cleanCat };
        categories.push(cat);
        saveTable('categories', categories);
      }
      gameCategories.push({ game_id: gameId, category_id: cat.category_id });
    });
    saveTable('game_categories', gameCategories);
  }

  // Create initial play log if hours provided
  if (parseFloat(gameData.total_hours || 0) > 0) {
    const logs = getTable('play_logs');
    logs.push({
      log_id: generateUUID(),
      game_id: gameId,
      hours_played: parseFloat(gameData.total_hours),
      logged_date: new Date().toISOString().substring(0, 10)
    });
    saveTable('play_logs', logs);
  }

  return newGame;
};

export const updateGame = (id, gameData) => {
  const games = getTable('games');
  const qProfiles = getTable('qualitative_profiles');
  const gameCategories = getTable('game_categories');
  const categories = getTable('categories');

  const idx = games.findIndex(g => g.game_id === id);
  if (idx === -1) throw new Error('Game not found');

  const game = games[idx];

  const updatedAcq = gameData.acquisition_type || game.acquisition_type;
  const updatedBaseCost = (updatedAcq === 'free' || updatedAcq === 'f2p') ? 0.00 : parseFloat(gameData.base_cost !== undefined ? gameData.base_cost : game.base_cost);
  const finalUnplayed = gameData.unplayed !== undefined ? gameData.unplayed === true : game.unplayed;

  let finalStatus = gameData.status || game.status || 'playing';
  if (finalUnplayed) {
    finalStatus = 'unplayed';
  } else if (game.unplayed && !finalUnplayed) {
    finalStatus = 'playing';
  }

  // Elo completes adjustments
  const oldStatus = game.status || 'playing';
  let newElo = game.elo_rating || 1200;
  if (oldStatus !== 'Finished' && finalStatus === 'Finished') newElo += 50;
  else if (oldStatus === 'Finished' && finalStatus !== 'Finished') newElo -= 50;
  if (oldStatus !== 'Did not Finish' && finalStatus === 'Did not Finish') newElo -= 50;
  else if (oldStatus === 'Did not Finish' && finalStatus !== 'Did not Finish') newElo += 50;

  const finalHasOpinion = gameData.has_opinion !== undefined ? gameData.has_opinion === true : game.has_opinion;

  games[idx] = {
    ...game,
    title: gameData.title || game.title,
    acquisition_type: updatedAcq,
    subscription_id: updatedAcq === 'subscription' ? (gameData.subscription_id || game.subscription_id) : null,
    base_cost: updatedBaseCost,
    unplayed: finalUnplayed,
    status: finalStatus,
    score_100: gameData.score_100 !== undefined ? gameData.score_100 : game.score_100,
    recommend: gameData.recommend !== undefined ? gameData.recommend : game.recommend,
    elo_rating: newElo,
    overall_hours: gameData.total_hours !== undefined ? parseFloat(gameData.total_hours) : game.overall_hours,
    play_mode: gameData.play_mode || game.play_mode || 'single',
    wont_play_again: gameData.wont_play_again !== undefined ? gameData.wont_play_again === true : !!game.wont_play_again,
    has_opinion: finalHasOpinion
  };
  saveTable('games', games);

  // Update qualitative profile
  if (gameData.qualitative) {
    const qIdx = qProfiles.findIndex(qp => qp.game_id === id);
    const q = gameData.qualitative;
    if (qIdx !== -1) {
      qProfiles[qIdx] = {
        ...qProfiles[qIdx],
        story: parseInt(q.story ?? qProfiles[qIdx].story ?? 5),
        multiplayer: parseInt(q.multiplayer ?? qProfiles[qIdx].multiplayer ?? 5),
        mechanics: parseInt(q.mechanics ?? qProfiles[qIdx].mechanics ?? 5),
        graphics: parseInt(q.graphics ?? qProfiles[qIdx].graphics ?? 5),
        challenge: parseInt(q.challenge ?? qProfiles[qIdx].challenge ?? 5),
        relaxation: parseInt(q.relaxation ?? qProfiles[qIdx].relaxation ?? 5),
        pacing: parseInt(q.pacing ?? qProfiles[qIdx].pacing ?? 5),
        engagement: parseInt(q.engagement ?? qProfiles[qIdx].engagement ?? 5),
        social: parseInt(q.social ?? qProfiles[qIdx].social ?? 5),
        stress_intensity: parseInt(q.stress_intensity ?? qProfiles[qIdx].stress_intensity ?? 5)
      };
    } else {
      qProfiles.push({
        profile_id: generateUUID(),
        game_id: id,
        story: parseInt(q.story ?? 5),
        multiplayer: parseInt(q.multiplayer ?? 5),
        mechanics: parseInt(q.mechanics ?? 5),
        graphics: parseInt(q.graphics ?? 5),
        challenge: parseInt(q.challenge ?? 5),
        relaxation: parseInt(q.relaxation ?? 5),
        pacing: parseInt(q.pacing ?? 5),
        engagement: parseInt(q.engagement ?? 5),
        social: parseInt(q.social ?? 5),
        stress_intensity: parseInt(q.stress_intensity ?? 5)
      });
    }
    saveTable('qualitative_profiles', qProfiles);
  }

  // Sync Categories
  if (gameData.categories && Array.isArray(gameData.categories)) {
    const filteredGc = gameCategories.filter(gc => gc.game_id !== id);
    gameData.categories.forEach(catName => {
      const cleanCat = catName.trim();
      if (!cleanCat) return;

      let cat = categories.find(c => c.name.toLowerCase() === cleanCat.toLowerCase());
      if (!cat) {
        cat = { category_id: generateUUID(), name: cleanCat };
        categories.push(cat);
        saveTable('categories', categories);
      }
      filteredGc.push({ game_id: id, category_id: cat.category_id });
    });
    saveTable('game_categories', filteredGc);
  }

  return { success: true };
};

export const deleteGame = (id) => {
  const games = getTable('games');
  const filteredGames = games.filter(g => g.game_id !== id);
  saveTable('games', filteredGames);

  const logs = getTable('play_logs');
  const filteredLogs = logs.filter(l => l.game_id !== id);
  saveTable('play_logs', filteredLogs);

  const purchases = getTable('game_purchases');
  const filteredPurchases = purchases.filter(p => p.game_id !== id);
  saveTable('game_purchases', filteredPurchases);

  const gameCategories = getTable('game_categories');
  const filteredGc = gameCategories.filter(gc => gc.game_id !== id);
  saveTable('game_categories', filteredGc);

  const qProfiles = getTable('qualitative_profiles');
  const filteredQp = qProfiles.filter(qp => qp.game_id !== id);
  saveTable('qualitative_profiles', filteredQp);

  return { success: true };
};

// Play Logs CRUD
export const getPlayLogs = (gameId) => {
  const logs = getTable('play_logs');
  return logs
    .filter(l => l.game_id === gameId)
    .sort((a, b) => new Date(b.logged_date) - new Date(a.logged_date));
};

export const createPlayLog = (gameId, logData) => {
  const logs = getTable('play_logs');
  const games = getTable('games');

  const logId = generateUUID();
  const hoursPlayed = parseFloat(logData.hours_played);
  const newLog = {
    log_id: logId,
    game_id: gameId,
    hours_played: hoursPlayed,
    logged_date: logData.logged_date || new Date().toISOString().substring(0, 10)
  };
  logs.push(newLog);
  saveTable('play_logs', logs);

  // Update game overall hours
  const idx = games.findIndex(g => g.game_id === gameId);
  if (idx !== -1 && logData.addToTotal) {
    games[idx].overall_hours = parseFloat(games[idx].overall_hours || 0) + hoursPlayed;
    games[idx].unplayed = false;
    if (games[idx].status === 'unplayed') games[idx].status = 'playing';
    saveTable('games', games);
  }

  return newLog;
};

export const deletePlayLog = (logId) => {
  const logs = getTable('play_logs');
  const log = logs.find(l => l.log_id === logId);
  if (!log) throw new Error('Play log not found');

  const filtered = logs.filter(l => l.log_id !== logId);
  saveTable('play_logs', filtered);

  // Deduct from game overall hours
  const games = getTable('games');
  const idx = games.findIndex(g => g.game_id === log.game_id);
  if (idx !== -1) {
    games[idx].overall_hours = Math.max(0, parseFloat(games[idx].overall_hours || 0) - parseFloat(log.hours_played));
    if (games[idx].overall_hours === 0) {
      games[idx].unplayed = true;
      games[idx].status = 'unplayed';
      games[idx].has_opinion = false;
    }
    saveTable('games', games);
  }

  return { success: true };
};

// Game Purchases CRUD
export const getPurchases = (gameId) => {
  const purchases = getTable('game_purchases');
  return purchases.filter(p => p.game_id === gameId);
};

export const createPurchase = (gameId, purchaseData) => {
  const purchases = getTable('game_purchases');
  const newPurchase = {
    purchase_id: generateUUID(),
    game_id: gameId,
    description: purchaseData.description,
    cost: parseFloat(purchaseData.cost),
    purchased_at: new Date().toISOString()
  };
  purchases.push(newPurchase);
  saveTable('game_purchases', purchases);
  return newPurchase;
};

export const deletePurchase = (id) => {
  const purchases = getTable('game_purchases');
  const filtered = purchases.filter(p => p.purchase_id !== id);
  saveTable('game_purchases', filtered);
  return { success: true };
};

// Pairwise Matchmaker
export const getPairwiseMatch = () => {
  const games = getTable('games');
  
  // Filter eligible played games with opinions
  const played = games.filter(g => !g.unplayed && parseFloat(g.overall_hours || 0) > 0 && g.has_opinion === true);
  
  if (played.length < 2) {
    throw new Error('You need at least 2 played games with opinions in your library to start comparison matches.');
  }

  let randomPrompt = COMPARISON_PROMPTS[Math.floor(Math.random() * COMPARISON_PROMPTS.length)];
  let modeFilterGames = [...played];

  if (randomPrompt.id === 'social') {
    modeFilterGames = played.filter(g => g.play_mode === 'multi' || g.play_mode === 'both');
  } else if (randomPrompt.id === 'solo') {
    modeFilterGames = played.filter(g => g.play_mode === 'single' || g.play_mode === 'both');
  }

  if (modeFilterGames.length < 2) {
    // Fallback to general comparison
    randomPrompt = COMPARISON_PROMPTS.find(p => p.id === 'general');
    modeFilterGames = [...played];
  }

  // Smart Matchmaking
  // Select Game A randomly, but give preference to games with fewer matches
  modeFilterGames.sort((a, b) => (a.match_count || 0) - (b.match_count || 0));
  const poolSize = Math.max(1, Math.floor(modeFilterGames.length * 0.4));
  const randomIdx = Math.floor(Math.random() * poolSize);
  const gameA = modeFilterGames[randomIdx];

  // Find Game B which has the closest ELO rating to Game A
  let gameB = null;
  let minDiff = Infinity;
  for (const g of modeFilterGames) {
    if (g.game_id === gameA.game_id) continue;
    const diff = Math.abs((g.elo_rating || 1200) - (gameA.elo_rating || 1200));
    if (diff < minDiff) {
      minDiff = diff;
      gameB = g;
    }
  }

  if (!gameB) {
    gameB = modeFilterGames.find(g => g.game_id !== gameA.game_id);
  }

  return { gameA, gameB, prompt: randomPrompt };
};

export const recordPairwiseMatch = (chosenId, gameAId, gameBId, promptType, reasonPillar) => {
  const games = getTable('games');
  const qProfiles = getTable('qualitative_profiles');
  const matches = getTable('pairwise_matches');

  const idxA = games.findIndex(g => g.game_id === gameAId);
  const idxB = games.findIndex(g => g.game_id === gameBId);
  if (idxA === -1 || idxB === -1) throw new Error('One or both games not found');

  const gameA = games[idxA];
  const gameB = games[idxB];

  const ratingA = gameA.elo_rating || 1200;
  const ratingB = gameB.elo_rating || 1200;

  // ELO Math
  const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  let K = 8;
  const pType = promptType || 'general';
  if (pType === 'general') K = 32;
  else if (pType === 'right_now') K = 48;
  else if (['relax', 'social', 'solo'].includes(pType)) K = 16;

  const SA = chosenId === gameAId ? 1 : 0;
  const SB = chosenId === gameBId ? 1 : 0;

  const newRatingA = Math.round(ratingA + K * (SA - EA));
  const newRatingB = Math.round(ratingB + K * (SB - EB));

  // Log Match
  const matchId = generateUUID();
  matches.push({
    match_id: matchId,
    user_id: 'local-default-user-id',
    game_a_id: gameAId,
    game_b_id: gameBId,
    chosen_game_id: chosenId,
    prompt_type: pType,
    created_at: new Date().toISOString()
  });
  saveTable('pairwise_matches', matches);

  // Update Elo & Match Count
  games[idxA].elo_rating = newRatingA;
  games[idxA].match_count = (games[idxA].match_count || 0) + 1;

  games[idxB].elo_rating = newRatingB;
  games[idxB].match_count = (games[idxB].match_count || 0) + 1;
  saveTable('games', games);

  // Update Qualitative profiles
  const unchosenId = chosenId === gameAId ? gameBId : gameAId;
  const qIdxChosen = qProfiles.findIndex(qp => qp.game_id === chosenId);
  const qIdxUnchosen = qProfiles.findIndex(qp => qp.game_id === unchosenId);

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

  const shiftSliders = (qIndex, column, boost) => {
    if (qIndex === -1) return;
    const current = qProfiles[qIndex][column] ?? 5;
    qProfiles[qIndex][column] = Math.max(0, Math.min(10, current + boost));
  };

  if (pType === 'solo') {
    shiftSliders(qIdxChosen, 'relaxation', 0.5);
    shiftSliders(qIdxChosen, 'story', 0.5);
    shiftSliders(qIdxChosen, 'multiplayer', -0.5);
    shiftSliders(qIdxChosen, 'social', -0.5);

    shiftSliders(qIdxUnchosen, 'relaxation', -0.5);
    shiftSliders(qIdxUnchosen, 'story', -0.5);
    shiftSliders(qIdxUnchosen, 'multiplayer', 0.5);
    shiftSliders(qIdxUnchosen, 'social', 0.5);
  } else if (columnMapping[pType]) {
    columnMapping[pType].forEach(col => {
      shiftSliders(qIdxChosen, col, 0.5);
      shiftSliders(qIdxUnchosen, col, -0.5);
    });
  }

  // Specific reason boost
  const validPillars = ['story', 'mechanics', 'graphics', 'challenge', 'pacing', 'engagement', 'relaxation', 'social', 'multiplayer', 'stress_intensity'];
  if (reasonPillar && validPillars.includes(reasonPillar)) {
    shiftSliders(qIdxChosen, reasonPillar, 1.0);
    shiftSliders(qIdxUnchosen, reasonPillar, -1.0);
  }

  saveTable('qualitative_profiles', qProfiles);

  return {
    gameA: { game_id: gameAId, old_rating: ratingA, new_rating: newRatingA, match_count: games[idxA].match_count },
    gameB: { game_id: gameBId, old_rating: ratingB, new_rating: newRatingB, match_count: games[idxB].match_count }
  };
};

export const recordPairwiseSort = (sortedIds, recommendations) => {
  const games = getTable('games');
  const matches = getTable('pairwise_matches');

  // Update recommendations
  if (recommendations) {
    Object.entries(recommendations).forEach(([gameId, recVal]) => {
      const idx = games.findIndex(g => g.game_id === gameId);
      if (idx !== -1) {
        games[idx].recommend = recVal === null || recVal === '' ? null : (recVal === true || recVal === 'true' || recVal === 'true');
      }
    });
  }

  const updatedRatings = {};

  // Process preferences G[i] beats G[i+1]
  for (let i = 0; i < sortedIds.length - 1; i++) {
    const winnerId = sortedIds[i];
    const loserId = sortedIds[i + 1];

    const idxW = games.findIndex(g => g.game_id === winnerId);
    const idxL = games.findIndex(g => g.game_id === loserId);

    if (idxW !== -1 && idxL !== -1) {
      const ratingW = games[idxW].elo_rating || 1200;
      const ratingL = games[idxL].elo_rating || 1200;

      const EW = 1 / (1 + Math.pow(10, (ratingL - ratingW) / 400));
      const EL = 1 / (1 + Math.pow(10, (ratingW - ratingL) / 400));

      const K = 16;
      const newRatingW = Math.round(ratingW + K * (1 - EW));
      const newRatingL = Math.round(ratingL + K * (0 - EL));

      games[idxW].elo_rating = newRatingW;
      games[idxW].match_count = (games[idxW].match_count || 0) + 1;

      games[idxL].elo_rating = newRatingL;
      games[idxL].match_count = (games[idxL].match_count || 0) + 1;

      matches.push({
        match_id: generateUUID(),
        user_id: 'local-default-user-id',
        game_a_id: winnerId,
        game_b_id: loserId,
        chosen_game_id: winnerId,
        prompt_type: 'card_sort',
        created_at: new Date().toISOString()
      });

      updatedRatings[winnerId] = newRatingW;
      updatedRatings[loserId] = newRatingL;
    }
  }

  saveTable('games', games);
  saveTable('pairwise_matches', matches);

  return { success: true, updatedRatings };
};

// Linear Sort (Long Line)
export const recordLinearSort = (gameId, insertIndex) => {
  const games = getTable('games');
  const matches = getTable('pairwise_matches');

  const idxTarget = games.findIndex(g => g.game_id === gameId);
  if (idxTarget === -1) throw new Error('Game not found');

  const targetGame = games[idxTarget];

  // Fetch all sorted games
  let sortedGames = games
    .filter(g => g.linear_position !== null)
    .sort((a, b) => a.linear_position - b.linear_position);

  // Remove target if it already exists
  const existingIdx = sortedGames.findIndex(g => g.game_id === gameId);
  if (existingIdx !== -1) {
    sortedGames.splice(existingIdx, 1);
  }

  // Splice in target
  sortedGames.splice(insertIndex, 0, targetGame);

  // Update positions in games table
  sortedGames.forEach((g, index) => {
    const idx = games.findIndex(x => x.game_id === g.game_id);
    if (idx !== -1) games[idx].linear_position = index;
  });

  // Bulk Elo updates across adjacent stack nodes
  const K = 32;
  let newEloTarget = targetGame.elo_rating || 1200;

  // Check front
  if (insertIndex > 0) {
    const frontGame = sortedGames[insertIndex - 1];
    const ratingA = frontGame.elo_rating || 1200;
    const ratingB = newEloTarget;

    const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    const newRatingA = Math.round(ratingA + K * (1 - EA));
    newEloTarget = Math.round(ratingB + K * (0 - EB));

    const idxF = games.findIndex(x => x.game_id === frontGame.game_id);
    if (idxF !== -1) {
      games[idxF].elo_rating = newRatingA;
      games[idxF].match_count = (games[idxF].match_count || 0) + 1;
    }

    matches.push({
      match_id: generateUUID(),
      user_id: 'local-default-user-id',
      exercise_type: 'long_line',
      game_a_id: frontGame.game_id,
      game_b_id: gameId,
      chosen_game_id: frontGame.game_id,
      created_at: new Date().toISOString()
    });
  }

  // Check behind
  if (insertIndex + 1 < sortedGames.length) {
    const behindGame = sortedGames[insertIndex + 1];
    const ratingA = newEloTarget;
    const ratingB = behindGame.elo_rating || 1200;

    const EA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const EB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    newEloTarget = Math.round(ratingA + K * (1 - EA));
    const newRatingB = Math.round(ratingB + K * (0 - EB));

    const idxB = games.findIndex(x => x.game_id === behindGame.game_id);
    if (idxB !== -1) {
      games[idxB].elo_rating = newRatingB;
      games[idxB].match_count = (games[idxB].match_count || 0) + 1;
    }

    matches.push({
      match_id: generateUUID(),
      user_id: 'local-default-user-id',
      exercise_type: 'long_line',
      game_a_id: gameId,
      game_b_id: behindGame.game_id,
      chosen_game_id: gameId,
      created_at: new Date().toISOString()
    });
  }

  games[idxTarget].elo_rating = newEloTarget;
  games[idxTarget].match_count = (games[idxTarget].match_count || 0) + (insertIndex > 0 ? 1 : 0) + (insertIndex + 1 < sortedGames.length ? 1 : 0);

  saveTable('games', games);
  saveTable('pairwise_matches', matches);

  return { success: true, new_elo: newEloTarget };
};

// Moods timeline
export const getMoodTimeline = () => {
  const moods = getTable('player_moods');
  return moods.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const createMood = (moodData) => {
  const moods = getTable('player_moods');
  const newMood = {
    mood_id: generateUUID(),
    user_id: 'local-default-user-id',
    mood_type: moodData.mood_type,
    created_at: new Date().toISOString()
  };
  moods.push(newMood);
  saveTable('player_moods', moods);
  return newMood;
};

// Categories
export const getCategories = () => {
  return getTable('categories');
};
