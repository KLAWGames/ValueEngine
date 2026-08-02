import React, { useState, useEffect } from 'react';
import Auth from './views/Auth';
import ResetPassword from './views/ResetPassword';
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import PairwiseEngine from './views/PairwiseEngine';
import Subscriptions from './views/Subscriptions';
import RecommendationView from './views/RecommendationView';
import { Gamepad2, LayoutDashboard, Database, Flame, LogOut, CreditCard, X, Settings, Clock, PlusCircle, ArrowLeft, CheckCircle2, Compass } from 'lucide-react';

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
              onNavigate={setActiveTab}
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
          {activeTab === 'recommendations' && (
            <RecommendationView token={token} games={games} />
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
            className={`tab-item ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            <Compass size={20} />
            <span>Oracle</span>
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
  const [mode, setMode] = useState('menu'); // 'menu' | 'select_games' | 'log_method' | 'wizard' | 'complete'
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logMethod, setLogMethod] = useState('session'); // 'session' | 'duration'
  const [wizardIndex, setWizardIndex] = useState(0);
  const [hoursInput, setHoursInput] = useState('1.0');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [logging, setLogging] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Sort games for selection: Recently Played first, then Alpha
  const recentGames = games.filter(g => g.last_played_at || g.total_hours > 0).slice(0, 6);
  const allAlphaGames = [...games].sort((a, b) => a.title.localeCompare(b.title));
  const searchFilteredGames = allAlphaGames.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleGameSelection = (gameId) => {
    setSelectedGameIds(prev => 
      prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
    );
  };

  const handleStartWizard = (method) => {
    setLogMethod(method);
    setWizardIndex(0);
    if (selectedGameIds.length > 0) {
      const firstGame = games.find(g => g.game_id === selectedGameIds[0]);
      if (firstGame) {
        setHoursInput(method === 'session' ? '1.0' : (firstGame.total_hours || 0).toString());
      }
    }
    setMode('wizard');
  };

  // Sync hoursInput whenever wizardIndex changes
  useEffect(() => {
    if (mode === 'wizard' && selectedGameIds[wizardIndex]) {
      const currentGame = games.find(g => g.game_id === selectedGameIds[wizardIndex]);
      if (currentGame) {
        setHoursInput(logMethod === 'session' ? '1.0' : (currentGame.total_hours || 0).toString());
      }
    }
  }, [wizardIndex, mode, logMethod, selectedGameIds, games]);

  const handleSaveCurrentWizardStep = async (skip = false) => {
    const currentGameId = selectedGameIds[wizardIndex];
    if (!skip && currentGameId) {
      const val = parseFloat(hoursInput);
      if (!isNaN(val)) {
        setLogging(true);
        try {
          if (logMethod === 'session') {
            await fetch(`/api/games/${currentGameId}/logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                hours_played: val,
                logged_date: logDate,
                addToTotal: true
              })
            });
          } else {
            await fetch(`/api/games/${currentGameId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                total_hours: val,
                unplayed: val === 0
              })
            });
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLogging(false);
        }
      }
    }

    if (wizardIndex < selectedGameIds.length - 1) {
      setWizardIndex(prev => prev + 1);
    } else {
      setMode('complete');
      setSuccessMsg(`Successfully updated time for ${selectedGameIds.length} game${selectedGameIds.length > 1 ? 's' : ''}!`);
      if (onRefresh) onRefresh();
      setTimeout(() => {
        onClose();
      }, 1400);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 10000 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '520px', width: '92%', padding: '24px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mode !== 'menu' && mode !== 'complete' && (
              <button 
                onClick={() => {
                  if (mode === 'log_method') setMode('select_games');
                  else if (mode === 'wizard') {
                    if (wizardIndex > 0) setWizardIndex(prev => prev - 1);
                    else setMode('log_method');
                  } else setMode('menu');
                }} 
                className="header-action-btn"
                style={{ padding: '6px', marginRight: '4px' }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>
                {mode === 'menu' && 'Welcome Back!'}
                {mode === 'select_games' && 'Select Games Played'}
                {mode === 'log_method' && 'Choose Update Method'}
                {mode === 'wizard' && `Game ${wizardIndex + 1} of ${selectedGameIds.length}`}
                {mode === 'complete' && 'All Done!'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                {mode === 'menu' && 'What would you like to do today?'}
                {mode === 'select_games' && 'Tap all the games you played recently:'}
                {mode === 'log_method' && 'Do you want to add session hours or update total time?'}
                {mode === 'wizard' && 'Enter hours for this title or skip:'}
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
              onClick={() => setMode('select_games')}
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
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Quickly select & update hours for your played games</div>
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

        {/* Mode: SELECT GAMES */}
        {mode === 'select_games' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflow: 'hidden' }}>
            
            {/* Quick Recent Section */}
            {recentGames.length > 0 && !searchQuery && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Recently Played
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {recentGames.map(g => {
                    const isSelected = selectedGameIds.includes(g.game_id);
                    return (
                      <button
                        key={g.game_id}
                        type="button"
                        onClick={() => toggleGameSelection(g.game_id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          readOnly 
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: isSelected ? '600' : 'normal' }}>{g.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search or filter library..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* Full Scrollable List */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px' }}>
              {searchFilteredGames.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No games matched "{searchQuery}"
                </div>
              ) : (
                searchFilteredGames.map(g => {
                  const isSelected = selectedGameIds.includes(g.game_id);
                  return (
                    <div
                      key={g.game_id}
                      onClick={() => toggleGameSelection(g.game_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        marginBottom: '4px',
                        background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                        border: isSelected ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          readOnly 
                          style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '600' : 'normal', color: '#fff' }}>
                          {g.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {g.total_hours || 0}h
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.85rem' }}
                onClick={() => {
                  onClose();
                  onAddGame();
                }}
              >
                + New Game
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2, fontSize: '0.85rem' }}
                disabled={selectedGameIds.length === 0}
                onClick={() => setMode('log_method')}
              >
                Next ({selectedGameIds.length} Selected)
              </button>
            </div>

          </div>
        )}

        {/* Mode: LOG METHOD */}
        {mode === 'log_method' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={() => handleStartWizard('session')}
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
                textAlign: 'left'
              }}
            >
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '12px', borderRadius: '10px' }}>
                <Clock size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Log Play Session</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                  Add hours spent in your recent play session (e.g. +2.0 hrs today).
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleStartWizard('duration')}
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
                textAlign: 'left'
              }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', borderRadius: '10px' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Update Total Duration</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                  Directly set overall cumulative hours (e.g. now at 45.0 hrs).
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Mode: WIZARD */}
        {mode === 'wizard' && selectedGameIds[wizardIndex] && (() => {
          const currentGame = games.find(g => g.game_id === selectedGameIds[wizardIndex]);
          if (!currentGame) return null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                  {currentGame.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Current Total Playtime: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{(currentGame.total_hours || 0).toFixed(1)}h</span>
                </div>
              </div>

              {logMethod === 'session' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Session Duration (Hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      className="form-input"
                      value={hoursInput}
                      onChange={e => setHoursInput(e.target.value)}
                      placeholder="e.g. 2.0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date Played</label>
                    <input
                      type="date"
                      className="form-input"
                      value={logDate}
                      onChange={e => setLogDate(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">New Cumulative Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    value={hoursInput}
                    onChange={e => setHoursInput(e.target.value)}
                    placeholder="e.g. 25.0"
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  onClick={() => handleSaveCurrentWizardStep(true)}
                  disabled={logging}
                >
                  Skip
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, fontSize: '0.85rem' }}
                  onClick={() => handleSaveCurrentWizardStep(false)}
                  disabled={logging}
                >
                  {logging ? 'Saving...' : (wizardIndex === selectedGameIds.length - 1 ? 'Save & Complete' : 'Save & Next')}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Mode: COMPLETE */}
        {mode === 'complete' && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--success)' }}>
            <CheckCircle2 size={56} style={{ margin: '0 auto 16px' }} />
            <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#fff' }}>{successMsg}</div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
