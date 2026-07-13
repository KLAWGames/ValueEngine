import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, TrendingDown, TrendingUp, AlertTriangle, Coffee, Film, Flame, Trophy, Play, AlertCircle } from 'lucide-react';

function Dashboard({ games, subscriptions, subscriptionWaste, wasteBreakdown, onNavigate, onTriggerEditGame, token, onRefresh }) {
  const [selectedGameId, setSelectedGameId] = useState('');
  const [showFreeGames, setShowFreeGames] = useState(false);
  const [moodTimeline, setMoodTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!token) return;
      setLoadingTimeline(true);
      try {
        const res = await fetch('/api/moods/timeline', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMoodTimeline(data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTimeline(false);
      }
    };
    fetchTimeline();
  }, [token, games]);

  // Aggregated general stats
  const totalInvestment = games.reduce((sum, g) => sum + g.total_cost, 0);
  const totalHours = games.reduce((sum, g) => sum + g.total_hours, 0);
  const averageCph = totalHours > 0 ? totalInvestment / totalHours : 0;

  // Games with play hours logged
  const playedGames = games.filter(g => g.total_hours > 0);

  // Playtime-based filtered played games for Economic Leaderboard (excluding free/f2p by default)
  const filteredPlayedGames = playedGames.filter(g => {
    if (showFreeGames) return true;
    const isFree = g.acquisition_type === 'free' || g.acquisition_type === 'f2p' || (parseFloat(g.base_cost) === 0 && !g.subscription_id);
    return !isFree;
  });

  // Top 10 Value Games (CPH)
  const topValueGames = [...filteredPlayedGames]
    .sort((a, b) => (a.cph || 0) - (b.cph || 0))
    .slice(0, 10);

  // Top 10 Joy Games (ELO)
  const topJoyGames = [...games]
    .sort((a, b) => b.elo_rating - a.elo_rating)
    .slice(0, 10);

  // "What to Play" Recommendations
  const recommendationCandidates = games.filter(g => {
    const isRetired = g.status === 'Finished' || g.status === 'Did not Finish' || g.status === 'No longer playing' || g.status === 'Uninstalled' || g.unplayed;
    const isLowScore = g.score_100 !== null && g.score_100 < 50;
    const isWontPlay = !!g.wont_play_again;
    return !isRetired && !isLowScore && !isWontPlay;
  });

  const whatToPlayRecommendations = [...recommendationCandidates]
    .sort((a, b) => parseFloat(a.overall_hours || a.total_hours || 0) - parseFloat(b.overall_hours || b.total_hours || 0))
    .slice(0, 3);

  const handleWontPlayAgain = async (gameId) => {
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          wont_play_again: true
        })
      });
      if (res.ok) {
        onRefresh();
      } else {
        alert('Failed to update recommendation');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Library Completeness Diagnostics
  const incompleteGames = games.filter(g => {
    if (g.unplayed) return false;
    const hours = parseFloat(g.total_hours || g.overall_hours || 0);
    if (hours === 0) return false;
    
    const hasNoCategories = !g.categories || g.categories.length === 0;
    const q = g.qualitative || {};
    const isDefaultSliders = Object.values(q).every(val => val === 5);
    
    return hasNoCategories || isDefaultSliders;
  });

  // Default selected game for comparison
  const defaultGame = playedGames.length > 0 
    ? [...playedGames].sort((a, b) => (a.cph || 0) - (b.cph || 0))[0]
    : null;

  const activeSelectedGame = games.find(g => g.game_id === selectedGameId) || defaultGame;

  // Baselines
  const baselines = [
    { name: 'Starbucks Latte', cph: 18.18, icon: Coffee, desc: '$6.00 / 20 min consumption' },
    { name: 'Restaurant Fine Wine', cph: 18.67, icon: Coffee, desc: '$14.00 / 45 min consumption' },
    { name: 'Movie Theater Outing', cph: 12.00, icon: Film, desc: '$24.00 ticket + concessions / 2 hr' },
    { name: 'Netflix Premium', cph: 0.66, icon: Film, desc: '$23.00 per month / 35 hr usage' },
  ];

  const chartGamesList = [...baselines];
  if (activeSelectedGame && activeSelectedGame.total_hours > 0) {
    chartGamesList.push({
      name: `🎮 ${activeSelectedGame.title}`,
      cph: activeSelectedGame.cph || 0,
      desc: `Your actual gameplay value (${activeSelectedGame.total_hours} hrs)`
    });
  }
  const maxCph = Math.max(...chartGamesList.map(b => b.cph), 20);

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

  const RenderMoodChart = () => {
    const [activePillars, setActivePillars] = useState({
      challenge: true,
      relaxation: true,
      story: true,
      mechanics: false,
      multiplayer: false,
      graphics: false,
      pacing: false
    });

    if (moodTimeline.length < 2) {
      return (
        <div className="no-data-msg" style={{ padding: '40px 0', textAlign: 'center' }}>
          Log play sessions across multiple weeks to see mood trends over time.
        </div>
      );
    }

    const width = 600;
    const height = 240;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const getCoordinates = (pillarKey) => {
      return moodTimeline.map((item, idx) => {
        const x = paddingLeft + (idx / (moodTimeline.length - 1)) * chartW;
        const val = item[pillarKey] || 0;
        const y = paddingTop + chartH - (val / 10) * chartH;
        return { x, y, val, week: item.week };
      });
    };

    const colors = {
      challenge: '#ef4444',
      relaxation: '#10b981',
      story: '#8b5cf6',
      mechanics: '#f59e0b',
      multiplayer: '#3b82f6',
      graphics: '#06b6d4',
      pacing: '#eab308'
    };

    const labels = {
      challenge: 'Challenge',
      relaxation: 'Relaxation',
      story: 'Story/Narrative',
      mechanics: 'Gameplay Mechanics',
      multiplayer: 'Multiplayer/Social',
      graphics: 'Graphics/Visuals',
      pacing: 'Pacing'
    };

    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(labels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePillars(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: activePillars[key] ? colors[key] : 'var(--border-color)',
                background: activePillars[key] ? `${colors[key]}1a` : 'transparent',
                color: activePillars[key] ? colors[key] : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[key] }} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 8px 8px' }}>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {[0, 2, 4, 6, 8, 10].map(val => {
              const y = paddingTop + chartH - (val / 10) * chartH;
              return (
                <g key={val}>
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x={paddingLeft - 10} y={y + 4} fill="var(--text-secondary)" fontSize="10" textAnchor="end">{val}</text>
                </g>
              );
            })}

            {moodTimeline.map((item, idx) => {
              const showLabel = idx === 0 || idx === moodTimeline.length - 1 || (moodTimeline.length < 8) || (idx % Math.round(moodTimeline.length / 4) === 0);
              if (!showLabel) return null;
              const x = paddingLeft + (idx / (moodTimeline.length - 1)) * chartW;
              const formattedDate = item.week.substring(5);
              return (
                <g key={idx}>
                  <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + chartH} stroke="rgba(255,255,255,0.03)" />
                  <text x={x} y={height - paddingBottom + 18} fill="var(--text-secondary)" fontSize="10" textAnchor="middle">{formattedDate}</text>
                </g>
              );
            })}

            {Object.entries(activePillars).map(([key, active]) => {
              if (!active) return null;
              const points = getCoordinates(key);
              if (points.length < 2) return null;
              const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <g key={key}>
                  <path d={pathData} fill="none" stroke={colors[key]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#151518"
                      stroke={colors[key]}
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{`${labels[key]}: ${p.val}/10\nWeek: ${p.week}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div>
      {incompleteGames.length > 0 && (
        <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', borderLeft: '4px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(167, 139, 250, 0.03)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertCircle size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ fontSize: '0.9rem' }}>
              <span style={{ fontWeight: '700', color: '#fff' }}>Diagnostic Alert: </span>
              You have <span className="bold-highlight">{incompleteGames.length} played games</span> missing category tags or qualitative review values.
              <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', display: 'inline-block' }}>
                Next up: <strong>{incompleteGames[0].title}</strong>
              </span>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => onTriggerEditGame(incompleteGames[0])}
            style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem', flexShrink: 0 }}
          >
            Update Details
          </button>
        </div>
      )}

      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card">
          <div className="stat-icon purple"><DollarSign size={24} /></div>
          <div className="stat-info">
            <h3>Total Invested</h3>
            <p>${totalInvestment.toFixed(2)}</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon cyan"><Clock size={24} /></div>
          <div className="stat-info">
            <h3>Hours Logged</h3>
            <p>{totalHours.toFixed(1)} hrs</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon accent"><TrendingDown size={24} /></div>
          <div className="stat-info">
            <h3>Average CPH</h3>
            <p>${averageCph.toFixed(2)}/hr</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon danger"><AlertTriangle size={24} /></div>
          <div className="stat-info">
            <h3>Subscription Waste</h3>
            <p>${subscriptionWaste.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {subscriptionWaste > 0 && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', marginBottom: '12px' }}>
            <AlertTriangle size={20} /> Subscription Waste Detected
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Amortized subscription costs are currently registering waste due to inactive billing cycles:
          </p>
          <div className="waste-list">
            {wasteBreakdown.slice(0, 3).map((item, idx) => (
              <div key={idx} className="waste-item">
                <div>
                  <div className="waste-item-name">{item.subscription_name}</div>
                  <div className="waste-item-details">{item.month ? `Waste billed for ${item.month}` : item.reason}</div>
                </div>
                <div className="waste-item-cost">+${item.cost.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="split-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', margin: 0, fontWeight: 'bold' }}>
              <TrendingDown size={20} className="cyan" /> Economic Value Leaderboard (Top 10)
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showFreeGames} onChange={(e) => setShowFreeGames(e.target.checked)} /> Show Free Games
            </label>
          </div>
          {topValueGames.length === 0 ? (
            <div className="no-data-msg" style={{ padding: '40px 0' }}>Add games and log play hours to see cost efficiency.</div>
          ) : (
            <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topValueGames.map((game, idx) => (
                <div key={game.game_id} className="leaderboard-item" style={{ padding: '10px 14px' }}>
                  <div className="game-title-badge">
                    <span className="rank-number" style={{ background: 'rgba(8, 145, 178, 0.1)', color: 'var(--cyan)' }}>#{idx + 1}</span>
                    <span className="game-name" style={{ fontSize: '0.95rem' }}>{game.title}</span>
                  </div>
                  <span className="game-score-tag cyan" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>${game.cph.toFixed(2)}/hr</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', marginBottom: '16px', fontWeight: 'bold' }}>
            <Trophy size={20} className="purple" /> Qualitative Preference Ladder (Top 10)
          </h3>
          {games.length === 0 ? (
            <div className="no-data-msg" style={{ padding: '40px 0' }}>No games in your library. Add games to see ELO rebalancing.</div>
          ) : (
            <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topJoyGames.map((game, idx) => (
                <div key={game.game_id} className="leaderboard-item" style={{ padding: '10px 14px' }}>
                  <div className="game-title-badge">
                    <span className="rank-number" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--primary)' }}>#{idx + 1}</span>
                    <span className="game-name" style={{ fontSize: '0.95rem' }}>{game.title}</span>
                  </div>
                  <span className="game-score-tag" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--primary)' }}>{game.elo_rating} Elo</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', marginBottom: '12px', fontWeight: 'bold' }}>
              <Play size={18} className="purple" /> What to Play Next
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>Suggestions based on games you are currently playing or want to play, sorted by lowest playtime:</p>
            {whatToPlayRecommendations.length === 0 ? (
              <div className="no-data-msg" style={{ padding: '20px 0' }}>No candidates available. Register currently playing games in Ledger to see recommendations.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {whatToPlayRecommendations.map(game => (
                  <div key={game.game_id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>{game.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Playtime: {parseFloat(game.overall_hours || game.total_hours || 0).toFixed(1)} hrs • Status: {game.status}</span>
                    </div>
                    <button type="button" className="card-action-btn" onClick={() => handleWontPlayAgain(game.game_id)} style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '4px 8px', border: 'none', background: 'rgba(239, 68, 68, 0.08)' }}>Won't Play</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(6,182,212,0.1) 100%)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '1.25rem', marginBottom: '8px' }}>
              <Flame size={22} className="purple" /> The Pairwise Joy Engine
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>Hone your library rankings using mathematically precise pairwise choices. Answer generic and context-sensitive rebalancing matchups to reweight ELO preferences.</p>
          </div>
          {games.length >= 2 ? (
            <button className="btn btn-primary" onClick={() => onNavigate('pairwise')}>
              <Play size={16} fill="white" /> <span>Launch Voting Arena</span>
            </button>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Add at least 2 games in the Game Ledger to launch voting.</div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', marginBottom: '8px', fontWeight: 'bold' }}>
          <TrendingUp size={18} className="purple" /> Dynamic Player Mood Analytics
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Correlates play logs with game profiles to trace how your gameplay mood shifts over time across narrative, social, mechanical, and difficulty components.
        </p>

        {loadingTimeline ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading mood trends...</div>
        ) : (
          <RenderMoodChart />
        )}
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>
            <DollarSign size={18} className="cyan" /> CPH Benchmarks & Real-World Outings
          </h3>
          {playedGames.length > 0 && (
            <select className="form-input form-select" style={{ width: 'auto', padding: '4px 30px 4px 10px', fontSize: '0.8rem' }} value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
              <option value="">-- Benchmark another game --</option>
              {playedGames.map(g => <option key={g.game_id} value={g.game_id}>{g.title}</option>)}
            </select>
          )}
        </div>

        <div className="statement-card glass-panel" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', marginBottom: '18px', padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>{renderComparisonStatement(activeSelectedGame)}</p>
        </div>

        <div className="benchmarks-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {chartGamesList
            .sort((a, b) => b.cph - a.cph)
            .map((b, idx) => {
              const isUserGame = b.name.startsWith('🎮');
              const widthPercent = Math.min(100, (b.cph / maxCph) * 100);
              return (
                <div key={idx} className="benchmark-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', borderRadius: '6px', borderLeft: isUserGame ? '4px solid var(--primary)' : 'none', background: isUserGame ? 'rgba(168,85,247,0.02)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={isUserGame ? { color: 'var(--primary)', fontWeight: 'bold' } : {}}>{b.name}</span>
                    <span style={{ fontWeight: '600' }}>${b.cph.toFixed(2)}/hr</span>
                  </div>
                  <div className="benchmark-gauge-container" style={{ height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className="benchmark-gauge-fill" style={{ height: '100%', width: `${widthPercent}%`, background: isUserGame ? 'linear-gradient(90deg, #c084fc 0%, var(--primary) 100%)' : 'linear-gradient(90deg, var(--secondary) 0%, #0891b2 100%)' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.desc}</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
