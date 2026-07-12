import React, { useState } from 'react';
import { DollarSign, Clock, TrendingDown, RefreshCw, AlertTriangle, Coffee, Film, Flame, Trophy, Play } from 'lucide-react';

function Dashboard({ games, subscriptions, subscriptionWaste, wasteBreakdown, onNavigate }) {
  const [selectedGameId, setSelectedGameId] = useState('');

  // Aggregated general stats
  const totalInvestment = games.reduce((sum, g) => sum + g.total_cost, 0);
  const totalHours = games.reduce((sum, g) => sum + g.total_hours, 0);
  const averageCph = totalHours > 0 ? totalInvestment / totalHours : 0;
  const activeSubsCount = subscriptions.filter(s => s.is_active === 1).length;

  // Games with play hours logged
  const playedGames = games.filter(g => g.total_hours > 0);
  
  // Default selected game for comparison
  const defaultGame = playedGames.length > 0 
    ? [...playedGames].sort((a, b) => (a.cph || 0) - (b.cph || 0))[0] // cheapest CPH
    : null;

  const activeSelectedGame = games.find(g => g.game_id === selectedGameId) || defaultGame;

  // Leaderboard data
  const topValueGames = [...playedGames]
    .sort((a, b) => (a.cph || 0) - (b.cph || 0))
    .slice(0, 5);

  const topJoyGames = [...games]
    .sort((a, b) => b.elo_rating - a.elo_rating)
    .slice(0, 5);

  // Baselines
  const baselines = [
    { name: 'Starbucks Latte', cph: 18.18, icon: Coffee, desc: '$6.00 / 20 min consumption' },
    { name: 'Restaurant Fine Wine', cph: 18.67, icon: Coffee, desc: '$14.00 / 45 min consumption' },
    { name: 'Movie Theater Outing', cph: 12.00, icon: Film, desc: '$24.00 ticket + concessions / 2 hr' },
    { name: 'Netflix Premium', cph: 0.66, icon: Film, desc: '$23.00 per month / 35 hr usage' },
  ];

  // Compare selected game against baselines
  const renderComparisonStatement = (game) => {
    if (!game) return "Log play sessions in the Game Ledger to view comparative economic benchmarks.";
    if (game.total_hours === 0) return `No playtime logged for "${game.title}" yet. Add playtime to see value calculations.`;

    const gameCph = game.cph || 0.01;
    const coffeeCph = 18.18;
    const movieCph = 12.00;

    const coffeeRatio = (coffeeCph / gameCph).toFixed(1);
    const movieRatio = (movieCph / gameCph).toFixed(1);

    return (
      <>
        Your experience with <span className="bold-highlight">"{game.title}"</span> cost you <span className="bold-highlight">${gameCph.toFixed(2)}/hr</span>. 
        This is <span className="bold-highlight">{coffeeRatio}x more cost-efficient</span> than your morning Starbucks routine (${coffeeCph.toFixed(2)}/hr) 
        and <span className="bold-highlight">{movieRatio}x cheaper</span> than a trip to the movie theater (${movieCph.toFixed(2)}/hr) per hour of active entertainment.
      </>
    );
  };

  // Find max CPH for graph scale (ensure selected game and baselines fit)
  const chartGamesList = [...baselines];
  if (activeSelectedGame && activeSelectedGame.total_hours > 0) {
    chartGamesList.push({
      name: `🎮 ${activeSelectedGame.title}`,
      cph: activeSelectedGame.cph || 0,
      desc: `Your actual gameplay value (${activeSelectedGame.total_hours} hrs)`
    });
  }
  const maxCph = Math.max(...chartGamesList.map(b => b.cph), 20);

  return (
    <div>
      {/* 4 Stats Grid */}
      <div className="dashboard-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon purple">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h3>Total Invested</h3>
            <p>${totalInvestment.toFixed(2)}</p>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon cyan">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h3>Hours Logged</h3>
            <p>{totalHours.toFixed(1)} hrs</p>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon accent">
            <TrendingDown size={24} />
          </div>
          <div className="stat-info">
            <h3>Average CPH</h3>
            <p>${averageCph.toFixed(2)}/hr</p>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon danger">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <h3>Subscription Waste</h3>
            <p>${subscriptionWaste.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Amortization Waste Notice */}
      {subscriptionWaste > 0 && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', marginBottom: '12px' }}>
            <AlertTriangle size={20} />
            Subscription Waste Detected
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
            You have active subscription services that did not register gameplay hours during billing periods. Consuming interactive media on subscriptions requires engagement to maintain value:
          </p>
          <div className="waste-list">
            {wasteBreakdown.slice(0, 3).map((item, idx) => (
              <div key={idx} className="waste-item">
                <div>
                  <div className="waste-item-name">{item.subscription_name}</div>
                  <div className="waste-item-details">
                    {item.month ? `Waste billed for ${item.month}` : item.reason}
                  </div>
                </div>
                <div className="waste-item-cost">+${item.cost.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="split-grid">
        {/* Left Side: Economic Benchmarking Dashboard */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div className="panel-header">
            <h2>
              <DollarSign size={22} className="cyan" />
              CPH Value Comparison
            </h2>
            {playedGames.length > 0 && (
              <select
                className="form-input form-select"
                style={{ width: 'auto', padding: '6px 36px 6px 12px', fontSize: '0.85rem' }}
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
              >
                <option value="">-- Select Game to Compare --</option>
                {playedGames.map(g => (
                  <option key={g.game_id} value={g.game_id}>{g.title}</option>
                ))}
              </select>
            )}
          </div>

          <div className="statement-card glass-panel" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', marginBottom: '28px' }}>
            <div className="statement-title">Value Summary</div>
            <p className="statement-text">
              {renderComparisonStatement(activeSelectedGame)}
            </p>
          </div>

          <div className="benchmarks-list">
            {chartGamesList
              .sort((a, b) => b.cph - a.cph)
              .map((b, idx) => {
                const isUserGame = b.name.startsWith('🎮');
                const widthPercent = Math.min(100, (b.cph / maxCph) * 100);
                
                return (
                  <div key={idx} className="benchmark-row" style={isUserGame ? { borderLeft: '4px solid var(--primary)', background: 'rgba(168,85,247,0.03)' } : {}}>
                    <div className="benchmark-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="benchmark-name" style={isUserGame ? { color: 'var(--primary)', fontWeight: 'bold' } : {}}>{b.name}</span>
                      </div>
                      <span className="benchmark-value">${b.cph.toFixed(2)}/hr</span>
                    </div>
                    <div className="benchmark-gauge-container">
                      <div 
                        className="benchmark-gauge-fill" 
                        style={{ 
                          width: `${widthPercent}%`,
                          background: isUserGame 
                            ? 'linear-gradient(90deg, #c084fc 0%, var(--primary) 100%)' 
                            : 'linear-gradient(90deg, var(--secondary) 0%, #0891b2 100%)'
                        }}
                      />
                    </div>
                    <div className="benchmark-desc">{b.desc}</div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Side: Leaderboards & Quick Match */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Pairwise CTA */}
          <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(6,182,212,0.15) 100%)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', flexDirection: 'column', justifycontent: 'space-between', gap: '16px' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '1.25rem', marginBottom: '8px' }}>
                <Flame size={22} className="purple" />
                The Pairwise Joy Engine
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Traditional rating scales are arbitrary. Run head-to-head pairwise choices between your games to build a mathematically accurate preference ladder using Elo rebalancing.
              </p>
            </div>
            {games.length >= 2 ? (
              <button className="btn btn-primary" onClick={() => onNavigate('pairwise')}>
                <Play size={16} fill="white" />
                <span>Launch Voting Arena</span>
              </button>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                Add at least 2 games in the Game Ledger to launch voting.
              </div>
            )}
          </div>

          {/* Top Value Leaderboard (Lowest CPH) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '16px' }}>
              <TrendingDown size={18} className="cyan" />
              Economic Value Leaderboard
            </h3>
            {topValueGames.length === 0 ? (
              <div className="no-data-msg">Add games and log play hours to see cost efficiency.</div>
            ) : (
              <div className="leaderboard-list">
                {topValueGames.map((game, idx) => (
                  <div key={game.game_id} className="leaderboard-item">
                    <div className="game-title-badge">
                      <span className="rank-number">#{idx + 1}</span>
                      <span className="game-name">{game.title}</span>
                    </div>
                    <span className="game-score-tag cyan">
                      ${game.cph.toFixed(2)}/hr
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Joy Leaderboard (Highest ELO) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '16px' }}>
              <Trophy size={18} className="purple" />
              Qualitative Preference Ladder
            </h3>
            {games.length === 0 ? (
              <div className="no-data-msg">No games in your library. Add games to see rankings.</div>
            ) : (
              <div className="leaderboard-list">
                {topJoyGames.map((game, idx) => (
                  <div key={game.game_id} className="leaderboard-item">
                    <div className="game-title-badge">
                      <span className="rank-number">#{idx + 1}</span>
                      <span className="game-name">{game.title}</span>
                    </div>
                    <span className="game-score-tag">
                      {game.elo_rating} Elo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;
