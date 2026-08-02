import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Play, CheckCircle2, ChevronRight, ThumbsUp, ThumbsDown, ChevronUp, ChevronDown, Layers, GripVertical } from 'lucide-react';

function PairwiseEngine({ token, games, onRefresh, onNavigate }) {
  const [activeMode, setActiveMode] = useState(null); // '1v1', 'sort', 'churn'
  
  // Churn Diagnostic States
  const [churnCandidates, setChurnCandidates] = useState([]);
  const [activeChurnIdx, setActiveChurnIdx] = useState(0);
  const [churnOutcome, setChurnOutcome] = useState(false);
  const [churnLoading, setChurnLoading] = useState(false);
  // 1v1 Arena States
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [pendingVote, setPendingVote] = useState(null);

  // Accordion details states for 1v1 Arena
  const [showDetailsA, setShowDetailsA] = useState(false);
  const [showDetailsB, setShowDetailsB] = useState(false);

  // Card Sorter States
  const [sortingGames, setSortingGames] = useState([]);
  const [sortingRecommendations, setSortingRecommendations] = useState({});
  const [sortingOutcome, setSortingOutcome] = useState(false);
  const [sortingResults, setSortingResults] = useState(null);
  const [sortLoading, setSortLoading] = useState(false);

  // Drag & Touch Reordering States
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartIndex, setTouchStartIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const items = [...sortingGames];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setSortingGames(items);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTouchStart = (index) => {
    setTouchStartIndex(index);
  };

  const handleTouchMove = (e, index) => {
    if (touchStartIndex === null || touchStartIndex === index) return;
    const items = [...sortingGames];
    const draggedItem = items[touchStartIndex];
    items.splice(touchStartIndex, 1);
    items.splice(index, 0, draggedItem);
    setTouchStartIndex(index);
    setSortingGames(items);
  };

  const handleTouchEnd = () => {
    setTouchStartIndex(null);
  };

  const fetchNextMatch = async () => {
    setLoading(true);
    setErrorMsg('');
    setOutcome(null);
    setShowDetailsA(false);
    setShowDetailsB(false);
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
    const played = games.filter(g => !g.unplayed && g.total_hours > 0 && g.has_opinion);
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
    const fetchChurn = async () => {
      try {
        const res = await fetch('/api/churn/candidates', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setChurnCandidates(data);
        }
      } catch (e) {}
    };
    fetchChurn();
  }, [token]);

  // Removed automatic mode picking on load
  useEffect(() => {
    // We intentionally don't pick a mode automatically now.
  }, []);

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
    const promptId = match.prompt?.id || 'general';
    if (promptId === 'general' || promptId === 'right_now') {
      setPendingVote({ winnerId });
    } else {
      executeVote(winnerId, null);
    }
  };

  const executeVote = async (winnerId, reasonPillar) => {
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
          prompt_type: match.prompt?.id || 'general',
          reason_pillar: reasonPillar
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
      setPendingVote(null);
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

  if (activeMode === 'sort' && sortingOutcome) {
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

        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn btn-primary" onClick={fetchNextMatch}>
            Keep playing 1v1 Arena
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('recommendations')}>
            Get a Recommendation
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('dashboard')}>
            Go back to Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveMode(null)}>
            Change Arena Mode
          </button>
        </div>
      </div>
    );
  }

  if (activeMode === '1v1' && (loading || !match)) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="vs-circle" style={{ margin: '0 auto 20px', animation: 'spin 1.5s linear infinite' }}>VS</div>
        <p>Analyzing library preferences & queuing match...</p>
      </div>
    );
  }

  if (activeMode === 'sort' && sortLoading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="vs-circle" style={{ margin: '0 auto 20px', animation: 'spin 1.5s linear infinite' }}>⇅</div>
        <p>Calculating ELO rebalancing and updating library...</p>
      </div>
    );
  }

  const profileA = match ? getQualitativeProfile(match.gameA.game_id) : null;
  const profileB = match ? getQualitativeProfile(match.gameB.game_id) : null;

  const renderPillars = (profile, isLeft) => {
    if (!profile) return null;
    const pillars = [
      { key: 'story', label: 'Story' },
      { key: 'multiplayer', label: 'Multiplayer' },
      { key: 'social', label: 'Community' },
      { key: 'mechanics', label: 'Mechanics' },
      { key: 'graphics', label: 'Graphics' },
      { key: 'challenge', label: 'Difficulty' },
      { key: 'relaxation', label: 'Relaxation' },
      { key: 'pacing', label: 'Pacing' }
    ];

    return (
      <div className="pillar-bars-list">
        {pillars.map(p => {
          const rating = profile[p.key]?.rating;
          const hasRating = rating !== undefined && rating !== null && rating !== '';
          return (
            <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div className="pillar-mini-row">
                <span className="pillar-mini-label">{p.label}</span>
                <span style={{ fontWeight: '600', color: hasRating ? '#fff' : 'var(--text-muted)' }}>
                  {hasRating ? `${rating}/10` : 'N/A'}
                </span>
              </div>
              <div className="pillar-mini-track">
                <div 
                  className="pillar-mini-fill" 
                  style={{ 
                    width: hasRating ? `${rating * 10}%` : '0%',
                    background: isLeft ? 'var(--primary)' : 'var(--secondary)'
                  }} 
                />
              </div>
            </div>
          );
        })}
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

      {!activeMode ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
          <p style={{ marginBottom: '24px' }}>Select an arena mode to get started:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px', margin: '0 auto' }}>
            <button className="btn btn-primary" onClick={() => { setActiveMode('1v1'); fetchNextMatch(); }}>
              1v1 Matchups
            </button>
            <button className="btn btn-primary" onClick={() => { setActiveMode('sort'); initCardSorter(); }}>
              Card Sorter (3-5 Games)
            </button>
            <button className="btn btn-primary" onClick={() => { setActiveMode('long_line'); }}>
              The Long Line
            </button>
          </div>
        </div>
      ) : activeMode === '1v1' ? (
        <>
          {pendingVote && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(10, 10, 12, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}>
              <div className="glass-panel" style={{
                maxWidth: '500px',
                width: '100%',
                padding: '32px',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                textAlign: 'center',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
                  Why did you prefer this game?
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Selecting a reason applies a qualitative rebalancing boost to the winner game's profile.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => executeVote(pendingVote.winnerId, 'story')}>
                    📖 Story/Narrative
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => executeVote(pendingVote.winnerId, 'multiplayer')}>
                    👥 Multiplayer/Social
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => executeVote(pendingVote.winnerId, 'mechanics')}>
                    ⚙️ Gameplay Mechanics
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => executeVote(pendingVote.winnerId, 'graphics')}>
                    🎨 Graphics/Visuals
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => executeVote(pendingVote.winnerId, 'challenge')}>
                    🏆 Challenge
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => executeVote(pendingVote.winnerId, 'relaxation')}>
                    🧘 Relaxation
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '10px', gridColumn: 'span 2' }} onClick={() => executeVote(pendingVote.winnerId, 'pacing')}>
                    ⏱️ Pacing
                  </button>
                </div>

                <button 
                  className="btn btn-secondary" 
                  onClick={() => executeVote(pendingVote.winnerId, null)}
                  style={{ width: '100%', background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}
                >
                  Skip Reason
                </button>
              </div>
            </div>
          )}

          {/* Glowing Matchup Context Prompt Box */}
          <div className="prompt-question-box" style={{ margin: '0 auto 16px', maxWidth: '680px', padding: '12px 16px', borderRadius: '12px', background: 'var(--primary)', border: '2px solid var(--accent)', textAlign: 'center', boxShadow: '0 0 15px rgba(167, 139, 250, 0.4)' }}>
            <span style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', display: 'block', marginBottom: '4px' }}>
              Active Matchup Prompt
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: 0, lineHeight: '1.3' }}>
              {match?.prompt?.text || 'Which experience do you prefer overall?'}
            </h2>
            {match?.prompt?.id === 'social' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSkipMultiplayer}
                style={{ marginTop: '8px', fontSize: '0.75rem', padding: '6px 12px', width: 'auto', display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none' }}
              >
                I don't feel like playing multiplayer games right now
              </button>
            )}
          </div>

          <div className="pairwise-arena">
            {/* Game A Card (Left) */}
            <div className="glass-panel voter-card left" style={{ padding: '12px', gap: '8px', background: 'rgba(167, 139, 250, 0.05)', border: '1px solid var(--primary)' }}>
              <div onClick={() => handleVote(match.gameA.game_id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                <h2 className="voter-game-title" style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>{match.gameA.title}</h2>
                <div className="voter-game-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Elo rating: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{match.gameA.elo_rating}</span>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={() => handleVote(match.gameA.game_id)}
                style={{ width: '100%', fontSize: '0.9rem', padding: '10px 12px', fontWeight: 'bold' }}
              >
                Prefer {match.gameA.title}
              </button>
            </div>

            {/* Versus Divider */}
            <div className="versus-divider">
              <div className="vs-circle" style={{ width: '36px', height: '36px', fontSize: '0.9rem', border: '2px solid var(--accent)' }}>VS</div>
            </div>

            {/* Game B Card (Right) */}
            <div className="glass-panel voter-card right" style={{ padding: '12px', gap: '8px', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid var(--cyan)' }}>
              <div onClick={() => handleVote(match.gameB.game_id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                <h2 className="voter-game-title" style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>{match.gameB.title}</h2>
                <div className="voter-game-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Elo rating: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{match.gameB.elo_rating}</span>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={() => handleVote(match.gameB.game_id)}
                style={{ width: '100%', fontSize: '0.9rem', padding: '10px 12px', fontWeight: 'bold' }}
              >
                Prefer {match.gameB.title}
              </button>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button className="btn btn-secondary" style={{ width: 'auto', fontSize: '0.85rem', padding: '6px 16px', marginRight: '8px' }} onClick={fetchNextMatch}>
              Skip Match
            </button>
            <button className="btn btn-secondary" style={{ width: 'auto', fontSize: '0.85rem', padding: '6px 16px' }} onClick={() => setActiveMode(null)}>
              Change Arena Mode
            </button>
          </div>
        </>
      ) : activeMode === 'sort' ? (
        /* Card Sorter UI */
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '16px' }}>
            Press and drag cards by the grip handle to sort from <strong>Most Favorite (top)</strong> to <strong>Least Favorite (bottom)</strong>. Toggle thumbs to recommend.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortingGames.map((game, index) => (
              <div 
                key={game.game_id} 
                className="glass-panel" 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onTouchStart={() => handleTouchStart(index)}
                onTouchMove={(e) => handleTouchMove(e, index)}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  display: 'flex', 
                  justify: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px', 
                  border: draggedIndex === index ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  opacity: draggedIndex === index ? 0.6 : 1,
                  background: draggedIndex === index ? 'rgba(168, 85, 247, 0.1)' : 'rgba(17, 24, 39, 0.6)',
                  cursor: 'grab',
                  userSelect: 'none',
                  transition: 'transform 0.15s ease, background 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <GripVertical size={22} style={{ color: 'var(--primary)', cursor: 'grab', flexShrink: 0 }} />
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
                  <div style={{ display: 'flex', gap: '6px' }}>
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
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexDirection: 'column', alignItems: 'center' }}>
            {sortingOutcome ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
                <button type="button" className="btn btn-primary" onClick={initCardSorter}>
                  Keep sorting more cards
                </button>
                <button className="btn btn-secondary" onClick={() => onNavigate('recommendations')}>
                  Get a Recommendation
                </button>
                <button className="btn btn-secondary" onClick={() => onNavigate('dashboard')}>
                  Go back to Dashboard
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveMode(null)}>
                  Change Arena Mode
                </button>
              </div>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={initCardSorter}>
                  Reshuffle Batch
                </button>
                <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSortSubmit}>
                  Submit Rankings
                </button>
              </>
            )}
          </div>
        </div>
      ) : activeMode === 'churn' && churnCandidates.length > 0 ? (
        <ChurnDiagnostic 
          candidate={churnCandidates[activeChurnIdx]} 
          games={games} 
          token={token}
          onComplete={() => {
            setActiveChurnIdx(prev => prev + 1);
            setChurnOutcome(true);
          }}
          onSkip={() => {
            setActiveChurnIdx(prev => prev + 1);
            pickNextMode();
          }}
          onKeepGoing={pickNextMode}
          showOutcome={churnOutcome}
        />
      ) : activeMode === 'long_line' ? (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '24px' }}>
            Isolate experience entirely from playtime or cost. Place unranked games exactly where they fit into your singular continuous stack of fun!
          </p>

          <LongLineSorter 
            games={games} 
            token={token} 
            onRefresh={onRefresh} 
          />
        </div>
      ) : null}
    </div>
  );
}

function ChurnDiagnostic({ candidate, games, token, onComplete, onSkip, onKeepGoing, showOutcome }) {
  const [toGameId, setToGameId] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [loading, setLoading] = useState(false);

  if (showOutcome) {
    return (
      <div className="glass-panel" style={{ padding: '40px', maxWidth: '580px', margin: '40px auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent)', marginBottom: '20px' }}>
          <CheckCircle2 size={54} />
        </div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Diagnostic Recorded!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
          Thanks! This data helps us map the "Value Engine" of your library to figure out what types of friction cause you to drop games.
        </p>
        <button className="btn btn-primary" onClick={onKeepGoing} style={{ width: 'auto' }}>
          Keep Going <ChevronRight size={18} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!reasonCategory) return alert('Please select a reason');
    setLoading(true);
    try {
      const res = await fetch('/api/churn/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          from_game_id: candidate.game_id,
          to_game_id: toGameId || null,
          reason_category: reasonCategory
        })
      });
      if (res.ok) onComplete();
      else alert('Failed to log churn diagnostic');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '32px' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
        Library Diagnostic
      </span>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px' }}>
        Why did you stop playing <span style={{ color: 'var(--accent)' }}>{candidate.title}</span>?
      </h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
        You logged over 2 hours into this game, but haven't played it in weeks.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.85rem' }}>Primary Reason</label>
        <select className="input-field" value={reasonCategory} onChange={e => setReasonCategory(e.target.value)}>
          <option value="">-- Select a reason --</option>
          <option value="finished">Finished the game</option>
          <option value="bored">Got bored / Pacing was too slow</option>
          <option value="frustrated">Too difficult / Frustrating</option>
          <option value="distracted">Distracted by another game</option>
          <option value="time">Didn't have enough time for it</option>
          <option value="multiplayer_friends">Friends stopped playing</option>
          <option value="other">Other / Just lost interest</option>
        </select>
      </div>

      {reasonCategory === 'distracted' && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.85rem' }}>Which game distracted you? (Optional)</label>
          <select className="input-field" value={toGameId} onChange={e => setToGameId(e.target.value)}>
            <option value="">-- Select a game --</option>
            {games.filter(g => g.game_id !== candidate.game_id).map(g => (
              <option key={g.game_id} value={g.game_id}>{g.title}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
        <button className="btn btn-secondary" onClick={onSkip} style={{ width: '100%' }}>
          Skip this game
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !reasonCategory} style={{ width: '100%' }}>
          {loading ? 'Saving...' : 'Submit Diagnostic'}
        </button>
      </div>
    </div>
  );
}

function LongLineSorter({ games, token, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [selectedGameToMove, setSelectedGameToMove] = useState(null);

  // Unsorted inventory (games that have no linear_position yet, and are not currently selected to move)
  const unsortedGames = games.filter(g => g.linear_position === null && !g.unplayed && g.has_opinion && (!selectedGameToMove || g.game_id !== selectedGameToMove.game_id));
  
  // Sorted stack (games that have linear_position set)
  const sortedStack = games
    .filter(g => g.linear_position !== null && (!selectedGameToMove || g.game_id !== selectedGameToMove.game_id))
    .sort((a, b) => a.linear_position - b.linear_position);

  // The active candidate to place: either the game selected to move, or the first unsorted game in inventory
  const activeCandidate = selectedGameToMove || (unsortedGames.length > 0 ? unsortedGames[0] : null);

  const handlePlaceGame = async (insertIndex) => {
    if (!activeCandidate) return;
    setLoading(true);
    try {
      const res = await fetch('/api/games/linear-sort', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          game_id: activeCandidate.game_id,
          insert_index: insertIndex
        })
      });
      if (res.ok) {
        setSelectedGameToMove(null);
        onRefresh();
      } else {
        alert('Failed to place game in linear stack');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromStack = async (gameId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          linear_position: null
        })
      });
      if (res.ok) {
        onRefresh();
      } else {
        alert('Failed to remove game from linear stack');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      {/* Active Candidate Placement Card */}
      {activeCandidate ? (
        <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--accent)', background: 'rgba(167, 139, 250, 0.03)', textAlign: 'center', position: 'sticky', top: '10px', zIndex: 100 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>
            {selectedGameToMove ? 'Repositioning Game' : 'Unsorted Inventory Candidate'}
          </span>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: '8px 0 4px' }}>{activeCandidate.title}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Current rating: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{activeCandidate.elo_rating} Elo</span>
          </p>
          
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 16px' }}>
            Scroll down the stack and click "Insert here" where this game fits in order of pure fun!
          </p>

          {selectedGameToMove && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => setSelectedGameToMove(null)}
            >
              Cancel Move
            </button>
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          🎉 All games in your library are currently placed in your linear stack of fun!
        </div>
      )}

      {/* Sorted Stack List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          Continuous Stack of Fun ({sortedStack.length} games)
        </h3>

        {sortedStack.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            {activeCandidate ? (
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ width: 'auto' }} 
                disabled={loading} 
                onClick={() => handlePlaceGame(0)}
              >
                Place "{activeCandidate.title}" to start stack
              </button>
            ) : (
              <div className="no-data-msg">Add played games in the Ledger to build your stack.</div>
            )}
          </div>
        ) : (
          <>
            {/* Top Drop Zone */}
            {activeCandidate && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={() => handlePlaceGame(0)}
                style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px dashed rgba(6, 182, 212, 0.3)', color: 'var(--cyan)', padding: '8px', margin: '4px 0', fontSize: '0.8rem', width: '100%' }}
              >
                ★ Place at Top (Most Fun)
              </button>
            )}

            {sortedStack.map((game, idx) => (
              <React.Fragment key={game.game_id}>
                {/* Game Card */}
                <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)' }}>
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>{game.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Elo: {game.elo_rating} • Playtime: {parseFloat(game.total_hours || 0).toFixed(1)}h
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="card-action-btn"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => setSelectedGameToMove(game)}
                    >
                      Reposition
                    </button>
                    <button
                      type="button"
                      className="card-action-btn"
                      style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.05)' }}
                      onClick={() => handleRemoveFromStack(game.game_id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Intermediate Drop Zone */}
                {activeCandidate && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={loading}
                    onClick={() => handlePlaceGame(idx + 1)}
                    style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', padding: '6px', margin: '4px 0', fontSize: '0.75rem', width: '100%' }}
                  >
                    ↑ Insert below "{game.title}" ↑
                  </button>
                )}
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default PairwiseEngine;
