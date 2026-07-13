import React, { useState, useEffect } from 'react';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import PairwiseEngine from './views/PairwiseEngine';
import Subscriptions from './views/Subscriptions';
import { Gamepad2, LayoutDashboard, Database, Flame, LogOut, CreditCard } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [games, setGames] = useState([]);
  const [subscriptionWaste, setSubscriptionWaste] = useState(0);
  const [wasteBreakdown, setWasteBreakdown] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [editGameOnLoad, setEditGameOnLoad] = useState(null);
  
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
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
    }
  }, [token]);

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
    </div>
  );
}

export default App;
