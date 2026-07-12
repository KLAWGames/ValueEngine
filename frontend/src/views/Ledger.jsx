import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, DollarSign, Edit, Trash2, BookOpen, Star, Sparkles, X, ThumbsUp, CheckCircle, HelpCircle } from 'lucide-react';

function Ledger({ token, games, subscriptions, onRefresh }) {
  // Filters & Search
  const [search, setSearch] = useState('');
  const [acqFilter, setAcqFilter] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'addGame' | 'editGame' | 'logHours' | 'addExpense'
  const [selectedGame, setSelectedGame] = useState(null);

  // Form states - Add / Edit Game
  const [title, setTitle] = useState('');
  const [acqType, setAcqType] = useState('retail');
  const [subId, setSubId] = useState('');
  const [baseCost, setBaseCost] = useState('0');
  const [totalHoursInput, setTotalHoursInput] = useState('0');
  const [unplayed, setUnplayed] = useState(false);
  const [status, setStatus] = useState('playing');
  const [score100, setScore100] = useState('');
  const [recommend, setRecommend] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [customCategory, setCustomCategory] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [qualitative, setQualitative] = useState({
    story: 5,
    mechanics: 5,
    graphics: 5,
    challenge: 5,
    relaxation: 5,
    pacing: 5,
    engagement: 5,
    multiplayer: 5,
    social: 5,
    stress_intensity: 5
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllCategories(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCategories();
    }
  }, [token]);

  const handleAddCustomCategory = async () => {
    if (!customCategory.trim()) return;
    const name = customCategory.trim();
    if (!selectedCategories.includes(name)) {
      setSelectedCategories([...selectedCategories, name]);
    }
    setCustomCategory('');

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        fetchCategories();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFetchSuggestions = async () => {
    if (!title) return;
    setIsSuggesting(true);
    try {
      const res = await fetch(`/api/games/suggest-categories?title=${encodeURIComponent(title)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedCategories(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSuggestedCategory = (cat) => {
    if (!cat) return;
    // Capitalize first letter of category for consistency
    const cleanCat = cat.charAt(0).toUpperCase() + cat.slice(1);
    if (!selectedCategories.includes(cleanCat)) {
      setSelectedCategories([...selectedCategories, cleanCat]);
    }
    fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: cleanCat })
    }).then(res => {
      if (res.ok) fetchCategories();
    });
  };

  // Form states - Log Play Session
  const [logHours, setLogHours] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [addToTotal, setAddToTotal] = useState(true);
  const [overallHoursInput, setOverallHoursInput] = useState('0');

  // Form states - Add Expense
  const [expDesc, setExpDesc] = useState('');
  const [expCost, setExpCost] = useState('');
  const [historyExpenses, setHistoryExpenses] = useState([]);

  // Filter and search games
  const filteredGames = games.filter(g => {
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase());
    const matchAcq = acqFilter ? g.acquisition_type === acqFilter : true;
    return matchSearch && matchAcq;
  });

  const openAddGameModal = () => {
    setTitle('');
    setAcqType('retail');
    setSubId('');
    setBaseCost('0');
    setTotalHoursInput('0');
    setUnplayed(false);
    setStatus('playing');
    setScore100('');
    setRecommend('');
    setSelectedCategories([]);
    setSuggestedCategories([]);
    setCustomCategory('');
    setQualitative({
      story: 5,
      mechanics: 5,
      graphics: 5,
      challenge: 5,
      relaxation: 5,
      pacing: 5,
      engagement: 5,
      multiplayer: 5,
      social: 5,
      stress_intensity: 5
    });
    setActiveModal('addGame');
  };

  const openEditGameModal = (game) => {
    setSelectedGame(game);
    setTitle(game.title);
    setAcqType(game.acquisition_type);
    setSubId(game.subscription_id || '');
    setBaseCost(game.base_cost.toString());
    setTotalHoursInput(game.total_hours.toString());
    setUnplayed(game.unplayed || false);
    setStatus(game.status || 'playing');
    setScore100(game.score_100 !== null && game.score_100 !== undefined ? game.score_100.toString() : '');
    setRecommend(game.recommend !== null && game.recommend !== undefined ? game.recommend.toString() : '');
    setSelectedCategories(game.categories || []);
    setSuggestedCategories([]);
    setCustomCategory('');
    setQualitative(game.qualitative || {
      story: 5,
      mechanics: 5,
      graphics: 5,
      challenge: 5,
      relaxation: 5,
      pacing: 5,
      engagement: 5,
      multiplayer: 5,
      social: 5,
      stress_intensity: 5
    });
    setActiveModal('editGame');
  };

  const openLogHoursModal = async (game) => {
    setSelectedGame(game);
    setLogHours('');
    setLogDate(new Date().toISOString().split('T')[0]);
    setAddToTotal(true);
    setOverallHoursInput(game.total_hours.toString());
    setActiveModal('logHours');
    
    // Fetch log history
    try {
      const res = await fetch(`/api/games/${game.game_id}/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setHistoryLogs(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const openAddExpenseModal = async (game) => {
    setSelectedGame(game);
    setExpDesc('');
    setExpCost('');
    setActiveModal('addExpense');

    // Fetch expense history
    try {
      const res = await fetch(`/api/games/${game.game_id}/purchases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setHistoryExpenses(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Submission actions
  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          acquisition_type: acqType,
          subscription_id: acqType === 'subscription' ? subId : null,
          base_cost: acqType === 'subscription' || acqType === 'free' || acqType === 'f2p' ? 0 : parseFloat(baseCost),
          qualitative,
          total_hours: parseFloat(totalHoursInput || 0),
          unplayed,
          categories: selectedCategories
        })
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create game');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateGame = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/games/${selectedGame.game_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          acquisition_type: acqType,
          subscription_id: acqType === 'subscription' ? subId : null,
          base_cost: acqType === 'subscription' || acqType === 'free' || acqType === 'f2p' ? 0 : parseFloat(baseCost),
          qualitative,
          total_hours: parseFloat(totalHoursInput || 0),
          unplayed,
          status,
          score_100: status === 'Finished' && score100 !== '' ? parseInt(score100) : null,
          recommend: status === 'Finished' && recommend !== '' ? (recommend === 'true') : null,
          categories: selectedCategories
        })
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update game');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this game? This will erase all play logs and expenses associated with it.')) {
      return;
    }

    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onRefresh();
      } else {
        alert('Failed to delete game');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogHours = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/games/${selectedGame.game_id}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hours_played: parseFloat(logHours),
          logged_date: logDate,
          addToTotal
        })
      });

      if (res.ok) {
        onRefresh();
        const addedHours = parseFloat(logHours);
        const updatedGame = {
          ...selectedGame,
          total_hours: addToTotal ? (selectedGame.total_hours + addedHours) : selectedGame.total_hours
        };
        setSelectedGame(updatedGame);
        openLogHoursModal(updatedGame);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to log play session');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateOverallHours = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/games/${selectedGame.game_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          total_hours: parseFloat(overallHoursInput || 0)
        })
      });

      if (res.ok) {
        onRefresh();
        const updatedGame = {
          ...selectedGame,
          total_hours: parseFloat(overallHoursInput || 0)
        };
        setSelectedGame(updatedGame);
        alert('Overall playtime updated successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update overall hours');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      const res = await fetch(`/api/logs/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onRefresh();
        openLogHoursModal(selectedGame);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/games/${selectedGame.game_id}/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: expDesc,
          cost: parseFloat(expCost)
        })
      });

      if (res.ok) {
        onRefresh();
        openAddExpenseModal(selectedGame);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add purchase');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteExpense = async (purchaseId) => {
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onRefresh();
        openAddExpenseModal(selectedGame);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQualitativeChange = (key, val) => {
    setQualitative(prev => ({
      ...prev,
      [key]: parseInt(val)
    }));
  };

  // Helper labels for sliders
  const pillarLabels = {
    story: 'Story/Narrative',
    mechanics: 'Gameplay Mechanics',
    graphics: 'Graphics/Visuals',
    challenge: 'Challenge/Difficulty',
    relaxation: 'Relaxation/Chill',
    pacing: 'Pacing/Flow',
    engagement: 'Engagement/Hook',
    multiplayer: 'Multiplayer Mode',
    social: 'Social/Community',
    stress_intensity: 'Stress/Intensity'
  };

  return (
    <div>
      {/* Search and Filters bar */}
      <div className="ledger-controls">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="form-input"
            placeholder="Search game title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-input form-select"
          style={{ width: 'auto', minWidth: '180px' }}
          value={acqFilter}
          onChange={(e) => setAcqFilter(e.target.value)}
        >
          <option value="">All Acquisition Types</option>
          <option value="retail">Retail Purchase</option>
          <option value="subscription">Subscription Game</option>
          <option value="free">Completely Free</option>
          <option value="f2p">Free to Play</option>
        </select>

        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddGameModal}>
          <Plus size={18} />
          <span>Add Game</span>
        </button>
      </div>

      {/* Games list grid */}
      {filteredGames.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <BookOpen size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No games found in your ledger. Click "Add Game" to register your first title!</p>
        </div>
      ) : (
        <div className="game-grid">
          {filteredGames.map(game => (
            <div key={game.game_id} className={`glass-panel game-card ${game.acquisition_type}`}>
              <div>
                <div className="game-card-header">
                  <h3 className="game-card-title">{game.title}</h3>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {game.unplayed ? (
                      <span className="status-badge unplayed">Unplayed</span>
                    ) : (
                      game.status && game.status !== 'playing' && (
                        <span className={`status-badge ${game.status.toLowerCase().replace(/ /g, '-')}`}>
                          {game.status}
                        </span>
                      )
                    )}
                    <span className={`acq-badge ${game.acquisition_type}`}>
                      {game.acquisition_type}
                    </span>
                  </div>
                </div>

                {/* Category Tags */}
                {game.categories && game.categories.length > 0 && (
                  <div className="game-card-tags" style={{ marginTop: '8px' }}>
                    {game.categories.map(cat => (
                      <span key={cat} className="category-tag">{cat}</span>
                    ))}
                  </div>
                )}

                <div className="game-card-cost">
                  {game.acquisition_type === 'subscription' ? (
                    <>
                      <div className="cost-line">
                        <span>Amortized Sub:</span>
                        <span>${game.amortized_subscription_cost.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        via {game.subscription_name || 'Active Subscription'}
                      </div>
                    </>
                  ) : (
                    <div className="cost-line">
                      <span>Base Cost:</span>
                      <span>${game.base_cost.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="cost-line">
                    <span>Add-ons / DLC:</span>
                    <span>${game.addon_cost.toFixed(2)}</span>
                  </div>

                  <div className="cost-line total">
                    <span>Total Investment:</span>
                    <span>${game.total_cost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="game-card-stats">
                  <div className="sub-stat">
                    <span className="sub-stat-label">Hours Logged</span>
                    <span className="sub-stat-value">{game.total_hours.toFixed(1)}h</span>
                  </div>
                  <div className="sub-stat">
                    <span className="sub-stat-label">Value CPH</span>
                    <span className="sub-stat-value">
                      {game.unplayed ? 'Unplayed' : (game.cph !== null ? `$${game.cph.toFixed(2)}/h` : 'N/A')}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {/* Qualitative small preview */}
                {!game.unplayed && game.qualitative && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary)' }}>
                      <Star size={10} fill="var(--primary)" />
                      <span>Elo: {game.elo_rating}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--secondary)' }}>
                      <Sparkles size={10} />
                      <span>Story: {game.qualitative.story}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)' }}>
                      <Sparkles size={10} />
                      <span>Mechs: {game.qualitative.mechanics}</span>
                    </div>
                  </div>
                )}

                {/* Finished review details */}
                {game.status === 'Finished' && (game.score_100 !== null || game.recommend !== null) && (
                  <div className="review-highlight-row">
                    {game.score_100 !== null && (
                      <div className="review-highlight-item" style={{ color: '#a78bfa' }}>
                        <CheckCircle size={10} />
                        <span>Score: {game.score_100}/100</span>
                      </div>
                    )}
                    {game.recommend !== null && (
                      <div className="review-highlight-item" style={{ color: game.recommend ? '#34d399' : '#f87171' }}>
                        <ThumbsUp size={10} style={{ transform: game.recommend ? 'none' : 'rotate(180deg)' }} />
                        <span>{game.recommend ? 'Recommends' : 'No Recommend'}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="game-card-actions">
                  <button className="card-action-btn" onClick={() => openLogHoursModal(game)}>
                    <Calendar size={14} />
                    <span>Log Time</span>
                  </button>
                  <button className="card-action-btn" onClick={() => openAddExpenseModal(game)}>
                    <DollarSign size={14} />
                    <span>Add DLC</span>
                  </button>
                  <button className="card-action-btn" onClick={() => openEditGameModal(game)}>
                    <Edit size={14} />
                    <span>Edit</span>
                  </button>
                  <button className="card-action-btn" style={{ flex: 'none', width: '38px', color: 'var(--danger)' }} onClick={() => handleDeleteGame(game.game_id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ADD / EDIT GAME MODAL --- */}
      {(activeModal === 'addGame' || activeModal === 'editGame') && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content">
            <div className="modal-title-row">
              <h2>{activeModal === 'addGame' ? 'Add Game to Ledger' : 'Edit Game Details'}</h2>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={activeModal === 'addGame' ? handleCreateGame : handleUpdateGame}>
              <div className="form-group">
                <label className="form-label">Game Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Space Marines II"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Acquisition Model</label>
                  <select
                    className="form-input form-select"
                    value={acqType}
                    onChange={(e) => setAcqType(e.target.value)}
                  >
                    <option value="retail">Retail Purchase</option>
                    <option value="subscription">Subscription Service</option>
                    <option value="free">Completely Free</option>
                    <option value="f2p">Free to Play (F2P)</option>
                  </select>
                </div>

                {acqType === 'subscription' ? (
                  <div className="form-group">
                    <label className="form-label">Subscription Registry</label>
                    <select
                      className="form-input form-select"
                      value={subId}
                      onChange={(e) => setSubId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Active Service --</option>
                      {subscriptions.map(s => (
                        <option key={s.subscription_id} value={s.subscription_id}>
                          {s.name} (${s.monthly_cost.toFixed(2)}/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  (acqType === 'retail') && (
                    <div className="form-group">
                      <label className="form-label">Base Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={baseCost}
                        onChange={(e) => setBaseCost(e.target.value)}
                        required
                      />
                    </div>
                  )
                )}

                {activeModal === 'addGame' && (
                  <div className="form-group">
                    <label className="form-label">Total Playtime (Hours)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-input"
                      value={totalHoursInput}
                      onChange={(e) => setTotalHoursInput(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Unplayed Toggle (only in add/edit modals when total playtime is 0) */}
              {parseFloat(totalHoursInput || 0) === 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={unplayed}
                      onChange={(e) => setUnplayed(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                      I haven't played this game yet (Unplayed)
                    </span>
                  </label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                    Unplayed games skip qualitative ratings and are excluded from Pairwise Joy matchmaking.
                  </p>
                </div>
              )}

              {/* Status, Surveys, and Categories tags: only available once hours > 0 */}
              {parseFloat(totalHoursInput || 0) > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  {/* Status Dropdown */}
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Game Status</label>
                    <select
                      className="form-input form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="playing">Currently Playing</option>
                      <option value="Finished">Finished</option>
                      <option value="Did not Finish">Did not Finish (DNF)</option>
                      <option value="No longer playing">No longer playing</option>
                      <option value="Uninstalled">Uninstalled</option>
                      <option value="Want to Revisit">Want to Revisit</option>
                    </select>
                  </div>

                  {/* Finished surveys */}
                  {status === 'Finished' && (
                    <div className="form-grid" style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', rowGap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Final Score (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="form-input"
                          value={score100}
                          onChange={(e) => setScore100(e.target.value)}
                          placeholder="e.g. 90"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Would you recommend this?</label>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="radio"
                              name="recommend"
                              value="true"
                              checked={recommend === 'true'}
                              onChange={(e) => setRecommend(e.target.value)}
                              style={{ accentColor: 'var(--primary)' }}
                              required
                            />
                            Yes, recommend
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="radio"
                              name="recommend"
                              value="false"
                              checked={recommend === 'false'}
                              onChange={(e) => setRecommend(e.target.value)}
                              style={{ accentColor: 'var(--primary)' }}
                              required
                            />
                            No, do not recommend
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Categories Tags Section */}
                  <div style={{ marginBottom: '20px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Categorize Game Genres</label>
                    <div className="tags-manager">
                      {allCategories.length > 0 && (
                        <div className="tags-list-selection" style={{ marginBottom: '8px' }}>
                          {allCategories.map(cat => {
                            const isActive = selectedCategories.includes(cat.name);
                            return (
                              <button
                                type="button"
                                key={cat.category_id}
                                className={`selectable-tag ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                  if (isActive) {
                                    setSelectedCategories(selectedCategories.filter(c => c !== cat.name));
                                  } else {
                                    setSelectedCategories([...selectedCategories, cat.name]);
                                  }
                                }}
                              >
                                {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Custom Tag */}
                      <div className="custom-tag-group" style={{ marginBottom: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Add custom tag (e.g. Co-op, Sci-Fi)"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCategory();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleAddCustomCategory}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Add Tag
                        </button>
                      </div>

                      {/* Wikidata Suggestions */}
                      <div>
                        <button
                          type="button"
                          className="suggest-btn"
                          disabled={isSuggesting}
                          onClick={handleFetchSuggestions}
                        >
                          {isSuggesting ? 'Searching...' : 'Suggest Genres (Fetch from Wikidata)'}
                        </button>
                        
                        {suggestedCategories.length > 0 && (
                          <div style={{ marginTop: '10px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suggested tags (click to add):</span>
                            <div className="suggested-badge-row">
                              {suggestedCategories.map(cat => (
                                <button
                                  type="button"
                                  key={cat}
                                  className="suggested-badge"
                                  onClick={() => handleAddSuggestedCategory(cat)}
                                >
                                  + {cat}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Qualitative Attribute Profiling Slider Deck (Hidden if Unplayed) */}
              {!unplayed && (
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <Sparkles size={16} />
                    Qualitative Pillar Profile (0-10)
                  </h3>
                  <div className="form-grid" style={{ rowGap: '8px' }}>
                    {Object.keys(qualitative).map(key => (
                      <div key={key} className="slider-container">
                        <div className="slider-info">
                          <span className="slider-label">{pillarLabels[key]}</span>
                          <span className="slider-val">{qualitative[key]}/10</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          className="custom-range-slider"
                          value={qualitative[key]}
                          onChange={(e) => handleQualitativeChange(key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {activeModal === 'addGame' ? 'Register Game' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LOG HOURS MODAL --- */}
      {activeModal === 'logHours' && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-title-row">
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Log Gameplay Hours</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedGame?.title}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Option A: Log Play Session */}
            <form onSubmit={handleLogHours} style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '12px', color: 'var(--primary)' }}>
                Option A: Log Play Session
              </h3>
              <div className="form-grid" style={{ marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Play Duration (Hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="form-input"
                    placeholder="e.g. 2.5"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date Played</label>
                  <input
                    type="date"
                    className="form-input"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Add to total checkbox */}
              <div style={{ marginBottom: '16px' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={addToTotal}
                    onChange={(e) => setAddToTotal(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                    Add this to overall hour total (current: {selectedGame?.total_hours.toFixed(1)}h)
                  </span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Log Play Session
              </button>
            </form>

            {/* Option B: Direct Playtime Overwrite */}
            <form onSubmit={handleUpdateOverallHours} style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '12px', color: 'var(--secondary)' }}>
                Option B: Update Overall Playtime (Manual Overwrite)
              </h3>
              <div className="form-grid" style={{ marginBottom: '12px', alignItems: 'end' }}>
                <div className="form-group">
                  <label className="form-label">Overall Playtime (Hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 45"
                    value={overallHoursInput}
                    onChange={(e) => setOverallHoursInput(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-secondary" style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                  Save Total Hours
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Directly sets the game's total hours. This keeps all your logged play history intact.
              </p>
            </form>

            <div style={{ marginTop: '28px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>History Logs</h3>
              {historyLogs.length === 0 ? (
                <div className="no-data-msg" style={{ padding: '20px' }}>No play logs registered yet.</div>
              ) : (
                <div className="list-wrapper">
                  {historyLogs.map(log => (
                    <div key={log.log_id} className="list-item">
                      <div>
                        <div className="list-item-title">{log.hours_played.toFixed(1)} hours</div>
                        <div className="list-item-sub">{log.logged_date}</div>
                      </div>
                      <button className="delete-icon-btn" onClick={() => handleDeleteLog(log.log_id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD EXPENSE MODAL --- */}
      {activeModal === 'addExpense' && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-title-row">
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Add Expense (DLC, Microtransactions)</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedGame?.title}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpense}>
              <div className="form-group">
                <label className="form-label">Expense Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Expansion Pass, 1000 Coins"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  placeholder="e.g. 19.99"
                  value={expCost}
                  onChange={(e) => setExpCost(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Record Purchase
              </button>
            </form>

            <div style={{ marginTop: '28px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Recorded Expenses</h3>
              {historyExpenses.length === 0 ? (
                <div className="no-data-msg" style={{ padding: '20px' }}>No add-on expenses recorded yet.</div>
              ) : (
                <div className="list-wrapper">
                  {historyExpenses.map(purchase => (
                    <div key={purchase.purchase_id} className="list-item">
                      <div>
                        <div className="list-item-title">{purchase.description}</div>
                        <div className="list-item-sub">{purchase.purchased_at.substring(0, 10)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontWeight: '600' }}>${purchase.cost.toFixed(2)}</span>
                        <button className="delete-icon-btn" onClick={() => handleDeleteExpense(purchase.purchase_id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Ledger;
