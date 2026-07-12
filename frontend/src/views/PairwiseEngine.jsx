import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Play, CheckCircle2, ChevronRight, ThumbsUp, ThumbsDown, ChevronUp, ChevronDown, Layers } from 'lucide-react';

function PairwiseEngine({ token, games, onRefresh }) {
  const [activeTab, setActiveTab] = useState('1v1'); // '1v1' | 'sort'
  
  // 1v1 Arena States
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [outcome, setOutcome] = useState(null);

  // Card Sorter States
  const [sortingGames, setSortingGames] = useState([]);
  const [sortingRecommendations, setSortingRecommendations] = useState({});
  const [sortingOutcome, setSortingOutcome] = useState(false);
  const [sortingResults, setSortingResults] = useState(null);
  const [sortLoading, setSortLoading] = useState(false);

  const fetchNextMatch = async () => {
    setLoading(true);
    setErrorMsg('');
    setOutcome(null);
    try {
      const res = await fetch('/api/pairwise/match', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMatch(data);
      } else {
        setErrorMsg(data.error || 'Failed to retrieve match');
        setMatch(null);
      }
    } catch (e) {
      setErrorMsg('Connection error fetching match');
    } finally {
      setLoading(false);
    }
  };

  const initCardSorter = () => {
    setErrorMsg('');
    setSortingOutcome(false);
    setSortingResults(null);
    const played = games.filter(g => !g.unplayed && g.total_hours > 0);
    if (played.length < 2) {
      setErrorMsg('You need at least 2 played games in your library to start comparisons.');
      return;
    }
    
    // Select a random size between 3 and 5 games, capped at library size
    const targetSize = Math.min(played.length, Math.floor(Math.random() * 3) + 3);
    
    // Random shuffle
    const shuffled = [...played].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, targetSize);
    setSortingGames(selected);
    
    const initialRecs = {};
    selected.forEach(g => {
      initialRecs[g.game_id] = g.recommend !== null ? g.recommend : true;
    });
    setSortingRecommendations(initialRecs);
  };

  useEffect(() => {
    if (activeTab === '1v1') {
      fetchNextMatch();
    } else {
      initCardSorter();
    }
  }, [activeTab, games.length]);

  const moveCard = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortingGames.length) return;
    
    const newGames = [...sortingGames];
    const temp = newGames[index];
    newGames[index] = newGames[targetIndex];
    newGames[targetIndex] = temp;
    setSortingGames(newGames);
  };

  const handleSortSubmit = async () => {
    setSortLoading(true);
    try {
      const res = await fetch('/api/pairwise/sort', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sorted_game_ids: sortingGames.map(g => g.game_id),
          recommendations: sortingRecommendations
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSortingResults(data.updatedRatings);
        setSortingOutcome(true);
        onRefresh();
      } else {
        alert(data.error || 'Failed to record sorting');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSortLoading(false);
    }
  };

  const handleSkipMultiplayer = async () => {
    try {
      await fetch('/api/moods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mood_type: 'no_multiplayer'
        })
      });
      fetchNextMatch();
    } catch (e) {
      console.error(e);
      fetchNextMatch();
    }
  };

  const handleVote = async (winnerId) => {
    if (!match) return;
    setLoading(true);
    try {
      const res = await fetch('/api/pairwise/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          game_a_id: match.gameA.game_id,
          game_b_id: match.gameB.game_id,
          chosen_game_id: winnerId,
          prompt_type: match.prompt?.id || 'general'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOutcome(data);
        onRefresh(); // Refresh global games list
      } else {
        alert('Failed to record choice');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Find qualitative profile from global games array
  const getQualitativeProfile = (gameId) => {
    const g = games.find(x => x.game_id === gameId);
    return g ? g.qualitative : null;
  };

  const getGameTitle = (gameId) => {
    const g = games.find(x => x.game_id === gameId);
    return g ? g.title : '';
  };

  if (errorMsg) {
    return (
      <div className="glass-panel" style={{ padding: '40px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Pairwise Arena Locked</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{errorMsg}</p>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    );
  }

  if (activeTab === 'sort' && sortingOutcome) {
    return (
      <div className="glass-panel" style={{ padding: '40px', maxWidth: '580px', margin: '40px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: '#10b981', marginBottom: '20px' }}>
          <CheckCircle2 size={54} />
        </div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', textAlign: 'center' }}>Sort Results Recorded!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', textAlign: 'center' }}>
          Your game rankings have successfully rebalanced the library ELO ratings:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
          {sortingGames.map((game, index) => {
            const oldElo = game.elo_rating;
            const newElo = sortingResults?.[game.game_id] || oldElo;
            const eloChange = newElo - oldElo;
            return (
              <div key={game.game_id} className="glass-panel" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: '500' }}>#{index + 1} {game.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{oldElo}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 'bold', color: eloChange > 0 ? '#34d399' : (eloChange < 0 ? '#f87171' : 'var(--text-muted)') }}>
                    {newElo} ({eloChange >= 0 ? `+${eloChange}` : eloChange})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="btn btn-primary" onClick={initCardSorter}>
          <span>Rank Another Batch</span>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  if (outcome) {
    const winnerName = getGameTitle(outcome.gameA.new_rating > outcome.gameA.old_rating ? outcome.gameA.game_id : outcome.gameB.game_id);
    const loserName = getGameTitle(outcome.gameA.new_rating > outcome.gameA.old_rating ? outcome.gameB.game_id : outcome.gameA.game_id);

    const eloChangeA = outcome.gameA.new_rating - outcome.gameA.old_rating;
    const eloChangeB = outcome.gameB.new_rating - outcome.gameB.old_rating;

    return (
      <div className="glass-panel" style={{ padding: '40px', maxWidth: '580px', margin: '40px auto', textalign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent)', marginBottom: '20px' }}>
          <CheckCircle2 size={54} />
        </div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', textAlign: 'center' }}>Match Recorded!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', textAlign: 'center' }}>
          You preferred <span className="bold-highlight">"{winnerName}"</span> over "{loserName}". The value rankings have rebalanced:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: '500' }}>{getGameTitle(outcome.gameA.game_id)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{outcome.gameA.old_rating}</span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: 'bold', color: eloChangeA > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {outcome.gameA.new_rating} ({eloChangeA > 0 ? `+${eloChangeA}` : eloChangeA})
              </span>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: '500' }}>{getGameTitle(outcome.gameB.game_id)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{outcome.gameB.old_rating}</span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: 'bold', color: eloChangeB > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {outcome.gameB.new_rating} ({eloChangeB > 0 ? `+${eloChangeB}` : eloChangeB})
              </span>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={fetchNextMatch}>
          <span>Continue Matchmaking</span>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  if (activeTab === '1v1' && (loading || !match)) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="vs-circle" style={{ margin: '0 auto 20px', animation: 'spin 1.5s linear infinite' }}>VS</div>
        <p>Analyzing library preferences & queuing match...</p>
      </div>
    );
  }

  if (activeTab === 'sort' && sortLoading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="vs-circle" style={{ margin: '0 auto 20px', animation: 'spin 1.5s linear infinite' }}>⇅</div>
        <p>Calculating ELO rebalancing and updating library...</p>
      </div>
    );
  }

  const profileA = getQualitativeProfile(match.gameA.game_id);
  const profileB = getQualitativeProfile(match.gameB.game_id);

  const renderPillars = (profile, isLeft) => {
    if (!profile) return null;
    const pillars = [
      { key: 'story', label: 'Story' },
      { key: 'mechanics', label: 'Mechanics' },
      { key: 'graphics', label: 'Graphics' },
      { key: 'challenge', label: 'Difficulty' },
      { key: 'relaxation', label: 'Relaxation' },
      { key: 'pacing', label: 'Pacing' },
      { key: 'engagement', label: 'Engagement' },
      { key: 'multiplayer', label: 'Multiplayer' },
      { key: 'social', label: 'Social' },
      { key: 'stress_intensity', label: 'Stress/Intensity' }
    ];

    return (
      <div className="pillar-bars-list">
        {pillars.map(p => (
          <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div className="pillar-mini-row">
              <span className="pillar-mini-label">{p.label}</span>
              <span style={{ fontWeight: '600' }}>{profile[p.key]}/10</span>
            </div>
            <div className="pillar-mini-track">
              <div 
                className="pillar-mini-fill" 
                style={{ 
                  width: `${profile[p.key] * 10}%`,
                  background: isLeft ? 'var(--primary)' : 'var(--secondary)'
                }} 
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2rem', marginBottom: '8px' }}>
          <Flame size={28} className="purple" />
          The Joy Arena
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Hone in on what you enjoy most. Choose between matchups or re-order batch stacks.
        </p>
      </div>

      {/* Mode Selection Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
        <button 
          className={`selectable-tag ${activeTab === '1v1' ? 'active' : ''}`}
          onClick={() => setActiveTab('1v1')}
          style={{ padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '600' }}
        >
          <Flame size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
          1v1 Arena
        </button>
        <button 
          className={`selectable-tag ${activeTab === 'sort' ? 'active' : ''}`}
          onClick={() => setActiveTab('sort')}
          style={{ padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '600' }}
        >
          <Layers size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
          Card Sorter (3-5 Games)
        </button>
      </div>

      {activeTab === '1v1' ? (
        <>
          {/* Glowing Matchup Context Prompt Box */}
          <div className="prompt-question-box" style={{ margin: '0 auto 28px', maxWidth: '680px', padding: '16px 24px', borderRadius: '12px', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.2)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
              Active Matchup Prompt
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              {match?.prompt?.text || 'Which experience do you prefer overall?'}
            </h2>
            {match?.prompt?.id === 'social' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSkipMultiplayer}
                style={{ marginTop: '14px', fontSize: '0.75rem', padding: '6px 12px', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                I don't feel like playing multiplayer games right now
              </button>
            )}
          </div>

          <div className="pairwise-arena">
            {/* Game A Card (Left) */}
            <div className="glass-panel voter-card left" onClick={() => handleVote(match.gameA.game_id)}>
              <div>
                <h2 className="voter-game-title">{match.gameA.title}</h2>
                <div className="voter-game-subtitle">
                  Elo rating: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{match.gameA.elo_rating}</span> ({match.gameA.match_count} matches)
                </div>
                {renderPillars(profileA, true)}
              </div>
              <div className="vote-cta">Select Game</div>
            </div>

            {/* Versus Divider */}
            <div className="versus-divider">
              <div className="vs-circle">VS</div>
            </div>

            {/* Game B Card (Right) */}
            <div className="glass-panel voter-card right" onClick={() => handleVote(match.gameB.game_id)}>
              <div>
                <h2 className="voter-game-title">{match.gameB.title}</h2>
                <div className="voter-game-subtitle">
                  Elo rating: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{match.gameB.elo_rating}</span> ({match.gameB.match_count} matches)
                </div>
                {renderPillars(profileB, false)}
              </div>
              <div className="vote-cta">Select Game</div>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={fetchNextMatch}>
              Skip Match / Get Another
            </button>
          </div>
        </>
      ) : (
        /* Card Sorter UI */
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '16px' }}>
            Sort these games from <strong>Most Favorite (top)</strong> to <strong>Least Favorite (bottom)</strong> using the Up/Down buttons. Toggle thumbs to quickly recommend them.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortingGames.map((game, index) => (
              <div key={game.game_id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--primary)' }}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>{game.title}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Elo: {game.elo_rating} • CPH: {game.unplayed ? 'Unplayed' : (game.cph !== null ? `$${game.cph.toFixed(2)}/h` : 'N/A')}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Recommendation thumbs */}
                  <div style={{ display: 'flex', gap: '6px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '4px' }}>
                    <button
                      type="button"
                      className={`card-action-btn ${sortingRecommendations[game.game_id] === true ? 'active' : ''}`}
                      onClick={() => setSortingRecommendations({ ...sortingRecommendations, [game.game_id]: true })}
                      style={{ background: sortingRecommendations[game.game_id] === true ? 'rgba(52, 211, 153, 0.15)' : 'transparent', color: sortingRecommendations[game.game_id] === true ? '#34d399' : 'var(--text-muted)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                      title="Recommend"
                    >
                      <ThumbsUp size={16} />
                    </button>
                    <button
                      type="button"
                      className={`card-action-btn ${sortingRecommendations[game.game_id] === false ? 'active' : ''}`}
                      onClick={() => setSortingRecommendations({ ...sortingRecommendations, [game.game_id]: false })}
                      style={{ background: sortingRecommendations[game.game_id] === false ? 'rgba(248, 113, 113, 0.15)' : 'transparent', color: sortingRecommendations[game.game_id] === false ? '#f87171' : 'var(--text-muted)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                      title="Do not recommend"
                    >
                      <ThumbsDown size={16} />
                    </button>
                  </div>

                  {/* Move Up/Down buttons */}
                  <button
                    type="button"
                    className="card-action-btn"
                    disabled={index === 0}
                    onClick={() => moveCard(index, -1)}
                    style={{ padding: '6px', opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                  >
                    <ChevronUp size={20} />
                  </button>
                  <button
                    type="button"
                    className="card-action-btn"
                    disabled={index === sortingGames.length - 1}
                    onClick={() => moveCard(index, 1)}
                    style={{ padding: '6px', opacity: index === sortingGames.length - 1 ? 0.3 : 1, cursor: index === sortingGames.length - 1 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={initCardSorter}>
              Reshuffle Batch
            </button>
            <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSortSubmit}>
              Submit Rankings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PairwiseEngine;
