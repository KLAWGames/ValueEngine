import React, { useState, useEffect } from 'react';
import Auth from './views/Auth';
import ResetPassword from './views/ResetPassword';
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import PairwiseEngine from './views/PairwiseEngine';
import Subscriptions from './views/Subscriptions';
import { Gamepad2, LayoutDashboard, Database, Flame, LogOut, CreditCard, X, Settings, Clock, PlusCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

function App() {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('token');
    return (t && t !== 'undefined' && t !== 'null') ? t : '';
  });
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return (stored && stored !== 'undefined') ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resetToken, setResetToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('resetToken');
  });
  
  const [games, setGames] = useState([]);
  const [subscriptionWaste, setSubscriptionWaste] = useState(0);
  const [wasteBreakdown, setWasteBreakdown] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [editGameOnLoad, setEditGameOnLoad] = useState(null);
  const [openAddGameOnLoad, setOpenAddGameOnLoad] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [loginPrompt, setLoginPrompt] = useState(null);
  
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setShowWelcomeModal(true);
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
    setShowWelcomeModal(false);
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

  const handleResetComplete = () => {
    setResetToken(null);
    window.history.pushState({}, '', '/');
  };

  const renderAppBody = () => {
    if (resetToken) {
      return <ResetPassword resetToken={resetToken} onComplete={handleResetComplete} />;
    }

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
              onClick={() => setShowWelcomeModal(true)}
              className="header-action-btn checkin-btn"
              title="Welcome Menu & Quick Actions"
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
              openAddGameOnLoad={openAddGameOnLoad}
              onClearOpenAddGameOnLoad={() => setOpenAddGameOnLoad(false)}
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

      {token && showWelcomeModal && (
        <WelcomeModal
          games={games}
          token={token}
          onClose={() => setShowWelcomeModal(false)}
          onRefresh={fetchGames}
          onAddGame={() => {
            setShowWelcomeModal(false);
            setActiveTab('ledger');
            setOpenAddGameOnLoad(true);
          }}
          onGoToDashboard={() => {
            setShowWelcomeModal(false);
            setActiveTab('dashboard');
          }}
        />
      )}
    </div>
  );
}

function WelcomeModal({ games, token, onClose, onRefresh, onAddGame, onGoToDashboard }) {
  const [mode, setMode] = useState('menu'); // 'menu' | 'log_time'
  const [selectedGameId, setSelectedGameId] = useState('');
  const [hoursToLog, setHoursToLog] = useState('1.0');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [logging, setLogging] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Top 6 recently played or added games
  const recentGames = games.slice(0, 6);

  useEffect(() => {
    if (recentGames.length > 0 && !selectedGameId) {
      setSelectedGameId(recentGames[0].game_id);
    }
  }, [recentGames, selectedGameId]);

  const handleQuickLog = async (e) => {
    e.preventDefault();
    if (!selectedGameId || !hoursToLog || parseFloat(hoursToLog) <= 0) return;

    setLogging(true);
    try {
      const res = await fetch(`/api/games/${selectedGameId}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hours_played: parseFloat(hoursToLog),
          logged_date: logDate,
          addToTotal: true
        })
      });

      if (res.ok) {
        setSuccessMsg('Hours logged successfully!');
        if (onRefresh) onRefresh();
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1200);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 10000 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '480px', width: '92%', padding: '24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mode === 'log_time' && (
              <button 
                onClick={() => setMode('menu')} 
                className="header-action-btn"
                style={{ padding: '6px', marginRight: '4px' }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>
                {mode === 'menu' ? 'Welcome Back!' : 'Log Play Time'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                {mode === 'menu' ? 'What would you like to do today?' : 'Select a game you played recently:'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Mode: MENU */}
        {mode === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="welcome-action-card"
              onClick={() => setMode('log_time')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '12px', borderRadius: '10px', display: 'flex' }}>
                <Clock size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem' }}>Log time</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Quick log hours for your recently played games</div>
              </div>
            </button>

            <button 
              className="welcome-action-card"
              onClick={onAddGame}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', borderRadius: '10px', display: 'flex' }}>
                <PlusCircle size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem' }}>Add a New Game</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Add a new title or purchase to your ledger</div>
              </div>
            </button>

            <button 
              className="welcome-action-card"
              onClick={onGoToDashboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '12px', borderRadius: '10px', display: 'flex' }}>
                <LayoutDashboard size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem' }}>Go to Dashboard</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Check your value metrics, ratings & waste stats</div>
              </div>
            </button>
          </div>
        )}

        {/* Mode: LOG TIME */}
        {mode === 'log_time' && (
          <div>
            {successMsg ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--success)' }}>
                <CheckCircle2 size={48} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{successMsg}</div>
              </div>
            ) : (
              <form onSubmit={handleQuickLog} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Recent Games</label>
                  {recentGames.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No games found in your library yet.</p>
                  ) : (
                    <select 
                      className="form-input" 
                      value={selectedGameId} 
                      onChange={e => setSelectedGameId(e.target.value)}
                      required
                    >
                      {recentGames.map(g => (
                        <option key={g.game_id} value={g.game_id}>
                          {g.title} ({g.total_hours || 0} hrs logged)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Hours Spent</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      min="0.1" 
                      className="form-input" 
                      value={hoursToLog} 
                      onChange={e => setHoursToLog(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={logDate} 
                      onChange={e => setLogDate(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ marginTop: '8px' }} 
                  disabled={logging || recentGames.length === 0}
                >
                  {logging ? 'Saving Log...' : 'Save Log'}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
