import React, { useState, useEffect } from 'react';
import { Compass, Flame, ArrowRight, Library, Globe, RefreshCcw } from 'lucide-react';

function RecommendationView({ token, games }) {
  const [mood, setMood] = useState('');
  const [mode, setMode] = useState('');
  
  const [libraryRecs, setLibraryRecs] = useState([]);
  const [externalRecs, setExternalRecs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (mood) queryParams.append('mood', mood);
      if (mode) queryParams.append('mode', mode);

      const [libRes, extRes] = await Promise.all([
        fetch(`/api/recommendations/library?${queryParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/recommendations/external?${queryParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (libRes.ok) setLibraryRecs(await libRes.json());
      if (extRes.ok) setExternalRecs(await extRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [mood, mode, token]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2rem', marginBottom: '8px' }}>
          <Compass size={28} className="purple" />
          The Oracle
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Discover what to play next based on your mathematical value profile and current mood.
        </p>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>I am feeling...</label>
          <select className="input-field" value={mood} onChange={e => setMood(e.target.value)}>
            <option value="">Any Mood</option>
            <option value="Relaxed">Relaxed / Cozy</option>
            <option value="Challenged">Competitive / Challenged</option>
            <option value="Social">Social</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>I want to play...</label>
          <select className="input-field" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="">Any Mode</option>
            <option value="Single-player">Single-player</option>
            <option value="Multi-player">Multi-player</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
          <button className="btn btn-secondary" onClick={fetchRecommendations} disabled={loading} style={{ width: 'auto', padding: '10px 16px' }}>
            <RefreshCcw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
        
        {/* Library Backlog Recs */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', marginBottom: '16px', fontWeight: 'bold' }}>
            <Library size={20} className="primary" /> From Your Backlog
          </h3>
          
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Consulting the oracle...</div>
          ) : libraryRecs.length === 0 ? (
            <div className="no-data-msg" style={{ padding: '40px 0' }}>No unplayed/backlog games fit this mood. Add more to your Ledger!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {libraryRecs.map(g => (
                <div key={g.game_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600' }}>{g.title}</h4>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {g.story !== null && <span>Story: {g.story}/10</span>}
                    {g.relaxation !== null && <span>Relaxation: {g.relaxation}/10</span>}
                    {g.challenge !== null && <span>Challenge: {g.challenge}/10</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* External RAWG Recs */}
        <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(6,182,212,0.05) 100%)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', marginBottom: '16px', fontWeight: 'bold' }}>
            <Globe size={20} className="cyan" /> From The Wild (RAWG.io)
          </h3>
          
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Scouring the internet...</div>
          ) : externalRecs.length === 0 ? (
            <div className="no-data-msg" style={{ padding: '40px 0' }}>No external recommendations found for this mood.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {externalRecs.map(g => (
                <div key={g.game_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600' }}>{g.title}</h4>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {g.rating > 0 && <span style={{ color: 'var(--accent)' }}>⭐ {g.rating}/5</span>}
                    <span>{g.genres}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default RecommendationView;
