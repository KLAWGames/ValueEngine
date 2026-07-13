import React, { useState, useEffect } from 'react';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import PairwiseEngine from './views/PairwiseEngine';
import Subscriptions from './views/Subscriptions';
import { Gamepad2, LayoutDashboard, Database, Flame, LogOut, CreditCard, X } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
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
        if (res.status === 403) logout();
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
      const sessionChecked = sessionStorage.getItem('recency_checked');
      if (!sessionChecked && user && user.login_prompt) {
        setLoginPrompt(user.login_prompt);
        sessionStorage.setItem('recency_checked', 'true');
      }
    }
  }, [token, user]);

  if (!token) {
    return <Auth onLogin={login} />;
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">
          <Gamepad2 size={24} />
          <span>VALUE ENGINE</span>
        </div>
        
        <div className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <Database size={18} />
            <span>Game Ledger</span>
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'pairwise' ? 'active' : ''}`}
            onClick={() => setActiveTab('pairwise')}
          >
            <Flame size={18} />
            <span>Pairwise Joy</span>
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            <CreditCard size={18} />
            <span>Subscriptions</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setLoginPrompt('weekly')}
            className="nav-item"
            style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', color: 'var(--accent)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Flame size={16} />
            <span>Habit Check-in</span>
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {user?.email}
          </span>
          <button 
            className="nav-item" 
            onClick={logout}
            style={{ background: 'none', border: 'none', font: 'inherit', color: 'var(--danger)', cursor: 'pointer' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

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
      </main>

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
