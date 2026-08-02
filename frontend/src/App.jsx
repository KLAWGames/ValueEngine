import React, { useState, useEffect } from 'react';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import PairwiseEngine from './views/PairwiseEngine';
import Subscriptions from './views/Subscriptions';
import { Gamepad2, LayoutDashboard, Database, Flame, LogOut, CreditCard, X, Settings } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return (stored && stored !== 'undefined') ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [games, setGames] = useState([]);
  const [subscriptionWaste, setSubscriptionWaste] = useState(0);
  const [wasteBreakdown, setWasteBreakdown] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [editGameOnLoad, setEditGameOnLoad] = useState(null);
  const [loginPrompt, setLoginPrompt] = useState(null);
  
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (newUser && newUser.login_prompt) {
      setLoginPrompt(newUser.login_prompt);
      sessionStorage.setItem('recency_checked', 'true');
    }
    setActiveTab('dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setGames([]);
    setSubscriptions([]);
  };

  const fetchGames = async () => {
    if (!token) return;
    setLoadingGames(true);
    try {
      const res = await fetch('/api/games', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGames(data.games || []);
        setSubscriptionWaste(data.subscription_waste || 0);
        setWasteBreakdown(data.waste_breakdown || []);
      } else {
        if (res.status === 403 || res.status === 401) logout();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGames(false);
    }
  };

  const fetchSubscriptions = async () => {
    if (!token) return;
    setLoadingSubs(true);
    try {
      const res = await fetch('/api/subscriptions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchGames();
      fetchSubscriptions();
      
      const lastOpenStr = localStorage.getItem('last_open_time');
      const now = Date.now();
      localStorage.setItem('last_open_time', now.toString());
      
      const sessionChecked = sessionStorage.getItem('recency_checked');
      if (!sessionChecked) {
        sessionStorage.setItem('recency_checked', 'true');
        if (lastOpenStr) {
          const lastOpen = parseInt(lastOpenStr);
          const diffDays = (now - lastOpen) / (1000 * 60 * 60 * 24);
          
          if (diffDays > 8.0) {
            setLoginPrompt('monthly');
          } else if (diffDays > 1.5) {
            setLoginPrompt('weekly');
          } else if (diffDays > 0.5) { // > 12 hours since last launch
            setLoginPrompt('daily');
          }
        } else {
          // If first launch, show check-in to orient user
          setLoginPrompt('daily');
        }
      }

      // Auto-migrate any offline/localStorage games created during Phase 3 to Turso cloud
      const ldbGamesRaw = localStorage.getItem('ldb_games');
      if (ldbGamesRaw) {
        try {
          const ldbGames = JSON.parse(ldbGamesRaw);
          if (Array.isArray(ldbGames) && ldbGames.length > 0) {
            console.log('Found browser localStorage games. Syncing to Turso cloud...', ldbGames);
            Promise.all(
              ldbGames.map(g => 
                fetch('/api/games', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    title: g.title,
                    acquisition_type: g.acquisition_type || 'retail',
                    subscription_id: g.subscription_id || null,
                    base_cost: g.base_cost || 0,
                    total_hours: g.overall_hours || 0,
                    unplayed: g.unplayed || false,
                    has_opinion: g.has_opinion !== undefined ? g.has_opinion : true
                  })
                })
              )
            ).then(() => {
              localStorage.removeItem('ldb_games');
              localStorage.removeItem('ldb_play_logs');
              localStorage.removeItem('ldb_qualitative_profiles');
              fetchGames();
            });
          }
        } catch (e) {
          console.error('Failed to auto-migrate browser games:', e);
        }
      }
    }
  }, [token]);

  const renderAppBody = () => {
    if (!token) {
      return <Auth onLogin={login} />;
    }

    return (
      <div className="app-container">
        {/* Mobile Status Bar Mock */}
        <div className="mobile-status-bar-mock">
          <span className="status-time">9:41</span>
          <div className="mobile-camera-notch"></div>
          <div className="status-icons">
            <span>📶</span> <span>🔋</span>
          </div>
        </div>

        {/* Mobile Header */}
        <header className="mobile-header">
          <div className="mobile-logo">
            <Gamepad2 size={20} />
            <span>VALUE ENGINE</span>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setLoginPrompt('weekly')}
              className="header-action-btn checkin-btn"
              title="Habit Check-in"
            >
              <Flame size={16} />
            </button>
            <button 
              className="header-action-btn logout-btn" 
              onClick={logout}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="main-content">
          {activeTab === 'dashboard' && (
            <Dashboard 
              games={games} 
              subscriptions={subscriptions} 
              subscriptionWaste={subscriptionWaste}
              wasteBreakdown={wasteBreakdown}
              onNavigate={setActiveTab}
              onTriggerEditGame={(game) => {
                setEditGameOnLoad(game);
                setActiveTab('ledger');
              }}
              token={token}
              onRefresh={fetchGames}
            />
          )}
          {activeTab === 'ledger' && (
            <Ledger 
              token={token} 
              games={games} 
              subscriptions={subscriptions} 
              onRefresh={fetchGames}
              editGameOnLoad={editGameOnLoad}
              onClearEditGameOnLoad={() => setEditGameOnLoad(null)}
            />
          )}
          {activeTab === 'pairwise' && (
            <PairwiseEngine 
              token={token} 
              games={games} 
              onRefresh={fetchGames}
            />
          )}
          {activeTab === 'subscriptions' && (
            <Subscriptions 
              token={token} 
              subscriptions={subscriptions} 
              games={games}
              onRefresh={() => { fetchSubscriptions(); fetchGames(); }}
            />
          )}
          {activeTab === 'settings' && (
            <div className="glass-panel settings-view" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '4px', color: '#fff' }}>App Settings</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Configure storage, backups, and recommendation engine pooling.</p>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#fff' }}>Database & Synchronization</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>Turso Cloud Sync</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Connected to value-engine. Auto-sync is active.</div>
                    </div>
                    <div style={{ padding: '4px 8px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      LIVE
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#fff' }}>Recommendation Pooling</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>Pool ELO & Sliders</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Contribute anonymous rating metrics to help train the global recommendation algorithm. No names or costs will be sent.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }} 
                      defaultChecked={localStorage.getItem('pooling_enabled') === 'true'} 
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        localStorage.setItem('pooling_enabled', enabled);
                        if (enabled) {
                          alert('Pooling enabled! Your anonymous game ELOs will be synced to the global dataset.');
                          const payload = games.filter(g => g.has_opinion).map(g => ({ title: g.title, elo: g.elo_rating }));
                          console.log('Sending to Google Sheets Webhook:', payload);
                          fetch('https://script.google.com/macros/s/AKfycbwaxCbGKkm8M2tlzPp-na7cAVRqfkNn_kc0K6yU30p1HoO-5XtZGJY9E2S1B-cTIzpZ/exec', { 
                            method: 'POST', 
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload) 
                          }).catch(err => console.error('Webhook error:', err));
                        }
                      }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Tab Bar Navigation */}
        <nav className="mobile-tab-bar">
          <div 
            className={`tab-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Home</span>
          </div>
          
          <div 
            className={`tab-item ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <Database size={20} />
            <span>Ledger</span>
          </div>
          
          <div 
            className={`tab-item ${activeTab === 'pairwise' ? 'active' : ''}`}
            onClick={() => setActiveTab('pairwise')}
          >
            <Flame size={20} />
            <span>Arena</span>
          </div>
          
          <div 
            className={`tab-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            <CreditCard size={20} />
            <span>Subs</span>
          </div>

          <div 
            className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </div>
        </nav>
      </div>
    );
  };

  return (
    <div className="device-viewport-wrapper">
      <div className="device-phone-mockup">
        {renderAppBody()}
      </div>

      {loginPrompt && (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '520px', width: '100%' }}>
            <div className="modal-title-row">
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Habit Check-in</h2>
                <p style={{ color: 'var(--accent)', fontWeight: '600', fontSize: '0.85rem', marginTop: '4px' }}>
                  {loginPrompt === 'daily' && "What games did you play yesterday?"}
                  {loginPrompt === 'weekly' && "What games did you play over the last week / past few days?"}
                  {loginPrompt === 'monthly' && "What games did you play over the last month?"}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setLoginPrompt(null)}>
                <X size={20} />
              </button>
            </div>

            <HabitCheckIn 
              games={games} 
              token={token} 
              onClose={() => setLoginPrompt(null)} 
              onRefresh={fetchGames} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

function HabitCheckIn({ games, token, onClose, onRefresh }) {
  const [selectedLogs, setSelectedLogs] = useState(() => {
    return games
      .filter(g => g.status === 'playing')
      .map(g => ({ game_id: g.game_id, title: g.title, hours: '1.0', checked: true }));
  });

  const [addGameId, setAddGameId] = useState('');

  const handleCheckboxChange = (idx, val) => {
    setSelectedLogs(prev => {
      const copy = [...prev];
      copy[idx].checked = val;
      return copy;
    });
  };

  const handleHoursChange = (idx, val) => {
    setSelectedLogs(prev => {
      const copy = [...prev];
      copy[idx].hours = val;
      return copy;
    });
  };

  const handleAddGame = () => {
    if (!addGameId) return;
    const match = games.find(g => g.game_id === addGameId);
    if (match && !selectedLogs.some(l => l.game_id === addGameId)) {
      setSelectedLogs(prev => [...prev, { game_id: match.game_id, title: match.title, hours: '1.0', checked: true }]);
    }
    setAddGameId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeLogs = selectedLogs.filter(l => l.checked && parseFloat(l.hours) > 0);
    if (activeLogs.length === 0) {
      onClose();
      return;
    }

    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      for (const log of activeLogs) {
        await fetch(`/api/games/${log.game_id}/logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            hours_played: parseFloat(log.hours),
            logged_date: todayStr,
            addToTotal: true,
            is_rotation_boost: true
          })
        });
      }
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error saving habits');
    }
  };

  const remainingGames = games.filter(g => !selectedLogs.some(l => l.game_id === g.game_id));

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
      <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px', marginBottom: '20px' }}>
        {selectedLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
            No active games in rotation. Add one below to log playtime.
          </div>
        ) : (
          selectedLogs.map((log, idx) => (
            <div key={log.game_id} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#fff', flex: 1, userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={log.checked}
                  onChange={(e) => handleCheckboxChange(idx, e.target.checked)}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.title}</span>
              </label>
              
              {log.checked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="form-input"
                    style={{ width: '80px', padding: '4px 8px', fontSize: '0.85rem', margin: 0 }}
                    value={log.hours}
                    onChange={(e) => handleHoursChange(idx, e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>hrs</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '20px' }}>
        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>Add other game to list</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            className="form-input form-select"
            style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem' }}
            value={addGameId}
            onChange={(e) => setAddGameId(e.target.value)}
          >
            <option value="">-- Select Game --</option>
            {remainingGames.map(g => (
              <option key={g.game_id} value={g.game_id}>{g.title}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '6px 16px', fontSize: '0.85rem', margin: 0 }}
            onClick={handleAddGame}
          >
            Add
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: 'auto' }}
          onClick={onClose}
        >
          Dismiss
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: 'auto' }}
        >
          Log Play & Boost ELO
        </button>
      </div>
    </form>
  );
}

export default App;
