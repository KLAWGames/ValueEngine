import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Search, Filter, ArrowUpDown, Star, Plus, Check, RefreshCw, 
  Calendar, Award, ExternalLink, Flame, Bookmark, Clock, Layers, CheckCircle2, ChevronRight, HelpCircle
} from 'lucide-react';

function PsPlusView({ token, onTriggerEditGame, onNavigate, onRefreshLedger }) {
  const [games, setGames] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('all'); // 'all' | 'essential' | 'extra' | 'premium'
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'available' | 'coming_soon' | 'watchlist'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'metacritic' | 'release_date' | 'title'
  const [syncMessage, setSyncMessage] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchPsPlusGames = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTier !== 'all') params.append('tier', selectedTier);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (sortBy) params.append('sort', sortBy);

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/psplus/games?${params.toString()}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setGames(data.games || []);
        setStats(data.stats || {});
      }
    } catch (e) {
      console.error('Error fetching PS+ games:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPsPlusGames();
  }, [selectedTier, selectedStatus, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPsPlusGames();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/psplus/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Synced ${data.totalInCatalog || data.addedCount || 'all'} titles!`);
        fetchPsPlusGames();
        setTimeout(() => setSyncMessage(''), 4000);
      }
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncMessage('Sync failed. Please check internet connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleWatchlist = async (game) => {
    if (!token) {
      alert('Please log in to save games to your "Games to Try" list.');
      return;
    }

    try {
      const res = await fetch('/api/psplus/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ psplus_id: game.psplus_id })
      });
      const data = await res.json();
      if (res.ok) {
        setGames(prev => prev.map(g => {
          if (g.psplus_id === game.psplus_id) {
            return { ...g, in_watchlist: data.in_watchlist ? 1 : 0 };
          }
          return g;
        }));
        setActionSuccess(data.in_watchlist ? `Added "${game.title}" to Games to Try!` : `Removed "${game.title}" from Games to Try`);
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportToLedger = async (game) => {
    if (!token) {
      alert('Please log in to add games to your ledger.');
      return;
    }

    try {
      const res = await fetch('/api/psplus/import-to-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ psplus_id: game.psplus_id })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Imported "${game.title}" into your Game Ledger!`);
        if (onRefreshLedger) onRefreshLedger();
        setTimeout(() => setActionSuccess(''), 3500);
      } else {
        alert(data.error || 'Failed to import to ledger');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getTierBadge = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'essential':
        return (
          <span style={{ 
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
            color: '#fff', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
          }}>
            ⭐ Essential
          </span>
        );
      case 'extra':
        return (
          <span style={{ 
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
            color: '#fff', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
          }}>
            ⚡ Extra
          </span>
        );
      case 'premium':
      case 'classics':
        return (
          <span style={{ 
            background: 'linear-gradient(135deg, #9333ea, #7e22ce)', 
            color: '#fff', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 6px rgba(147, 51, 234, 0.3)'
          }}>
            💎 Premium
          </span>
        );
      default:
        return null;
    }
  };

  const getMetacriticColor = (score) => {
    if (!score) return { bg: 'rgba(255,255,255,0.08)', text: 'var(--text-muted)' };
    if (score >= 85) return { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', border: '#22c55e' };
    if (score >= 75) return { bg: 'rgba(132, 204, 22, 0.2)', text: '#a3e635', border: '#84cc16' };
    if (score >= 60) return { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15', border: '#eab308' };
    return { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: '#ef4444' };
  };

  // Filter coming soon games for dedicated showcase banner
  const comingSoonGames = games.filter(g => g.is_coming_soon);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast notification */}
      {actionSuccess && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '24px',
          fontSize: '0.85rem',
          fontWeight: '600',
          boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Header & Sync Bar */}
      <div className="glass-panel" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(147, 51, 234, 0.1))', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #00439c, #0070d1)', 
                color: '#fff', 
                padding: '8px', 
                borderRadius: '10px', 
                display: 'flex', 
                boxShadow: '0 4px 12px rgba(0, 112, 209, 0.4)' 
              }}>
                <Sparkles size={22} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
                PlayStation Plus Hub
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px', maxWidth: '520px', lineHeight: '1.4' }}>
              Real-time catalog across Essential, Extra, and Premium tiers. Updated twice daily with Metacritic ratings and upcoming drops.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="btn btn-secondary" 
              style={{ 
                fontSize: '0.8rem', 
                padding: '8px 14px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)'
              }}
              title="Poll official PlayStation Blog and store catalogs for new additions"
            >
              <RefreshCw size={14} className={syncing ? 'spinning' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync Catalog'}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#60a5fa', background: 'rgba(37, 99, 235, 0.1)', padding: '6px 12px', borderRadius: '6px' }}>
            {syncMessage}
          </div>
        )}

        {/* Quick Stats Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginTop: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Total Games</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{stats.total_count || games.length}</div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: '600' }}>⭐ Essential</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>{stats.essential_count || 0}</div>
          </div>
          <div style={{ background: 'rgba(37, 99, 235, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: '#60a5fa', textTransform: 'uppercase', fontWeight: '600' }}>⚡ Extra</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#93c5fd', marginTop: '2px' }}>{stats.extra_count || 0}</div>
          </div>
          <div style={{ background: 'rgba(147, 51, 234, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: '600' }}>💎 Premium</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#e9d5ff', marginTop: '2px' }}>{stats.premium_count || 0}</div>
          </div>
          <div style={{ background: 'rgba(236, 72, 153, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: '#f472b6', textTransform: 'uppercase', fontWeight: '600' }}>⏳ Coming Soon</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fbcfe8', marginTop: '2px' }}>{stats.coming_soon_count || comingSoonGames.length}</div>
          </div>
        </div>
      </div>

      {/* "COMING SOON" SPOTLIGHT SECTION */}
      {comingSoonGames.length > 0 && selectedStatus !== 'watchlist' && (
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #ec4899', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Clock size={18} style={{ color: '#ec4899' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#fff' }}>
              Coming Soon to PlayStation Plus
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#f472b6', background: 'rgba(236, 72, 153, 0.2)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              Confirmed Releases
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {comingSoonGames.map(game => (
              <div 
                key={game.psplus_id} 
                style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: '10px', 
                  padding: '12px', 
                  border: '1px solid rgba(236, 72, 153, 0.25)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}
              >
                {game.image_url ? (
                  <img 
                    src={game.image_url} 
                    alt={game.title} 
                    style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles size={20} color="#ec4899" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {game.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {getTierBadge(game.tier)}
                    <span style={{ fontSize: '0.7rem', color: '#f472b6', fontWeight: '600' }}>
                      📅 {game.release_date_psplus || 'Upcoming'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleToggleWatchlist(game)}
                    style={{
                      marginTop: '6px',
                      background: game.in_watchlist ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.08)',
                      color: game.in_watchlist ? '#fbbf24' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Star size={12} fill={game.in_watchlist ? '#fbbf24' : 'none'} />
                    <span>{game.in_watchlist ? 'In Try List' : 'Add to Try List'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTER, SEARCH & SORT CONTROLS */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Search bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', borderRadius: '24px', fontSize: '0.9rem' }}
            placeholder="Search PlayStation Plus catalog by title, genre, or publisher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tier Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: 'All Tiers', count: stats.total_count },
            { id: 'essential', label: '⭐ Essential (Monthly)', count: stats.essential_count },
            { id: 'extra', label: '⚡ Extra (Catalog)', count: stats.extra_count },
            { id: 'premium', label: '💎 Premium (Classics)', count: stats.premium_count }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTier(tab.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: selectedTier === tab.id ? '700' : '500',
                background: selectedTier === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: selectedTier === tab.id ? '#fff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: selectedTier === tab.id ? 'var(--primary)' : 'var(--border-color)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {tab.label} {tab.count !== undefined && <span style={{ opacity: 0.75 }}>({tab.count})</span>}
            </button>
          ))}
        </div>

        {/* Secondary filters & Sort Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setSelectedStatus('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: selectedStatus === 'all' ? '700' : 'normal',
                background: selectedStatus === 'all' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: selectedStatus === 'all' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              All
            </button>
            <button
              onClick={() => setSelectedStatus('available')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: selectedStatus === 'available' ? '700' : 'normal',
                background: selectedStatus === 'available' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: selectedStatus === 'available' ? '#4ade80' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Available Now
            </button>
            <button
              onClick={() => setSelectedStatus('coming_soon')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: selectedStatus === 'coming_soon' ? '700' : 'normal',
                background: selectedStatus === 'coming_soon' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                color: selectedStatus === 'coming_soon' ? '#f472b6' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ⏳ Coming Soon
            </button>
            <button
              onClick={() => setSelectedStatus('watchlist')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: selectedStatus === 'watchlist' ? '700' : 'normal',
                background: selectedStatus === 'watchlist' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                color: selectedStatus === 'watchlist' ? '#fbbf24' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Star size={12} fill={selectedStatus === 'watchlist' ? '#fbbf24' : 'none'} />
              <span>Games to Try</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={14} /> Sort By:
            </span>
            <select
              className="form-input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recent">🕒 Most Recently Added</option>
              <option value="metacritic">🏆 Highest Metacritic Score</option>
              <option value="release_date">📅 PS+ Release Date</option>
              <option value="title">🔤 Alphabetical (A - Z)</option>
            </select>
          </div>

        </div>

      </div>

      {/* GAMES GRID */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 12px' }} />
          <div>Loading PlayStation Plus Catalog...</div>
        </div>
      ) : games.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <Bookmark size={40} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '6px' }}>
            {selectedStatus === 'watchlist' ? 'No games in your "Games to Try" list yet.' : 'No PlayStation Plus games match your filter.'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {selectedStatus === 'watchlist' ? 'Click the ⭐ star button on any game to bookmark it here!' : 'Try clearing your search or switching tiers.'}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '16px' 
        }}>
          {games.map(game => {
            const metaStyle = getMetacriticColor(game.metacritic_score);
            return (
              <div 
                key={game.psplus_id}
                className="glass-panel"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  border: game.in_watchlist ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid var(--border-color)'
                }}
              >
                {/* Top Banner Row */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  
                  {/* Game Cover / Icon */}
                  {game.image_url ? (
                    <img 
                      src={game.image_url} 
                      alt={game.title} 
                      style={{ 
                        width: '72px', 
                        height: '72px', 
                        borderRadius: '10px', 
                        objectFit: 'cover', 
                        flexShrink: 0,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                      }} 
                    />
                  ) : (
                    <div style={{ 
                      width: '72px', 
                      height: '72px', 
                      borderRadius: '10px', 
                      background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexShrink: 0 
                    }}>
                      <Sparkles size={24} color="#6366f1" />
                    </div>
                  )}

                  {/* Title & Tier Info */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {getTierBadge(game.tier)}
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                        {game.platforms || 'PS5/PS4'}
                      </span>
                    </div>

                    <h4 style={{ 
                      fontSize: '1rem', 
                      fontWeight: '700', 
                      color: '#fff', 
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {game.title}
                    </h4>
                  </div>
                </div>

                {/* Score & Timing Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px' }}>
                  
                  {/* Metacritic Score Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Metacritic:</span>
                    {game.metacritic_score ? (
                      <span style={{ 
                        background: metaStyle.bg, 
                        color: metaStyle.text, 
                        border: `1px solid ${metaStyle.border || 'transparent'}`,
                        fontWeight: '800', 
                        fontSize: '0.85rem', 
                        padding: '2px 8px', 
                        borderRadius: '6px' 
                      }}>
                        {game.metacritic_score}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TBA</span>
                    )}
                  </div>

                  {/* Added Date / Status */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {game.is_coming_soon ? (
                      <span style={{ color: '#f472b6', fontWeight: '700' }}>
                        ⏳ Coming {game.release_date_psplus || ''}
                      </span>
                    ) : (
                      <span>Added {game.date_added || 'Recently'}</span>
                    )}
                  </div>

                </div>

                {/* Description Snippet */}
                {game.description && (
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    lineHeight: '1.4',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {game.description}
                  </p>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                  
                  {/* "To Try" Watchlist Toggle */}
                  <button
                    onClick={() => handleToggleWatchlist(game)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: game.in_watchlist ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: game.in_watchlist ? '#fbbf24' : 'var(--text-secondary)',
                      border: game.in_watchlist ? '1px solid #fbbf24' : '1px solid var(--border-color)',
                      transition: 'all 0.15s'
                    }}
                    title={game.in_watchlist ? 'Remove from Games to Try' : 'Add to Games to Try'}
                  >
                    <Star size={14} fill={game.in_watchlist ? '#fbbf24' : 'none'} color={game.in_watchlist ? '#fbbf24' : 'currentColor'} />
                    <span>{game.in_watchlist ? 'Saved' : 'To Try'}</span>
                  </button>

                  {/* Add to Value Engine Game Ledger */}
                  <button
                    onClick={() => handleImportToLedger(game)}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    title="Import this title into your Value Engine ledger as an active subscription game"
                  >
                    <Plus size={14} />
                    <span>+ Ledger</span>
                  </button>

                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default PsPlusView;
