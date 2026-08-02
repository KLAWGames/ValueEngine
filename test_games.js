const db = require('./database.js');

async function testFetchGames() {
  const userId = '4af4811a-ca56-4ef8-b7e5-ddb57f581725';
  try {
    const gamesRes = await db.query('SELECT * FROM games WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    console.log('Games count:', gamesRes.rows.length);

    // Let's run the exact queries from server.js lines 360-440
    const subsRes = await db.query('SELECT * FROM subscriptions WHERE user_id = $1 AND is_active = 1', [userId]);
    console.log('Subscriptions count:', subsRes.rows.length);

    const activeSubs = subsRes.rows;
    const gameAmortized = {};

    for (const sub of activeSubs) {
      const subGamesRes = await db.query(
        "SELECT game_id FROM games WHERE subscription_id = $1 AND (status = 'playing' OR status IS NULL OR unplayed = 0)",
        [sub.subscription_id]
      );
      console.log('Sub games count for', sub.name, ':', subGamesRes.rows.length);
    }

    const purchasesRes = await db.query(`
      SELECT gp.game_id, SUM(gp.cost) as addon_cost
      FROM game_purchases gp
      JOIN games g ON gp.game_id = g.game_id
      WHERE g.user_id = $1
      GROUP BY gp.game_id
    `, [userId]);
    console.log('Purchases count:', purchasesRes.rows.length);

    for (const game of gamesRes.rows) {
      const qualRes = await db.query('SELECT * FROM qualitative_profiles WHERE game_id = $1', [game.game_id]);
      const catsRes = await db.query(`
        SELECT c.name FROM categories c
        JOIN game_categories gc ON c.category_id = gc.category_id
        WHERE gc.game_id = $1
      `, [game.game_id]);
    }

    console.log('All query steps passed without errors!');
  } catch (err) {
    console.error('SERVER FETCH GAMES ERROR:', err);
  }
}

testFetchGames();
