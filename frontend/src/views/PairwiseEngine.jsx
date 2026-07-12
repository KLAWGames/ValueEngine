import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Play, CheckCircle2, ChevronRight } from 'lucide-react';

function PairwiseEngine({ token, games, onRefresh }) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [outcome, setOutcome] = useState(null); // stores the result of the last match voted on

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

  useEffect(() => {
    fetchNextMatch();
  }, []);

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
          chosen_game_id: winnerId
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

  if (loading || !match) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="vs-circle" style={{ margin: '0 auto 20px', animation: 'spin 1.5s linear infinite' }}>VS</div>
        <p>Analyzing library preferences & queuing match...</p>
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
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2rem', marginBottom: '8px' }}>
          <Flame size={28} className="purple" />
          The Joy Arena
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Which of these two experiences do you prefer? Click on a card to record your choice.
        </p>
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
      
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={fetchNextMatch}>
          Skip Match / Get Another
        </button>
      </div>
    </div>
  );
}

export default PairwiseEngine;
