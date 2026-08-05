import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, DollarSign, Edit, Trash2, BookOpen, Star, Sparkles, X, ThumbsUp, CheckCircle, HelpCircle, ChevronDown } from 'lucide-react';

function Ledger({ token, games, subscriptions, onRefresh, editGameOnLoad, onClearEditGameOnLoad, openAddGameOnLoad, onClearOpenAddGameOnLoad }) {
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
  const [hasOpinion, setHasOpinion] = useState(true);
  const [playMode, setPlayMode] = useState('single');
  const [status, setStatus] = useState('playing');
  const [score100, setScore100] = useState('');
  const [recommend, setRecommend] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [customCategory, setCustomCategory] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [qualitative, setQualitative] = useState({
    story: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    multiplayer: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    social: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    mechanics: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    gameplay_loop: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    game_design: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    interfaces: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    graphics: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    challenge: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    relaxation: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    pacing: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
    replayability: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false }
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

  useEffect(() => {
    if (editGameOnLoad) {
      const matchGame = games.find(g => g.game_id === editGameOnLoad.game_id);
      if (matchGame) {
        openEditGameModal(matchGame);
      } else {
        openEditGameModal(editGameOnLoad);
      }
      onClearEditGameOnLoad();
    }
  }, [editGameOnLoad, games]);

  useEffect(() => {
    if (openAddGameOnLoad) {
      openAddGameModal();
      if (onClearOpenAddGameOnLoad) onClearOpenAddGameOnLoad();
    }
  }, [openAddGameOnLoad]);

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
  const [isHistoricalLog, setIsHistoricalLog] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [addToTotal, setAddToTotal] = useState(true);
  const [overallHoursInput, setOverallHoursInput] = useState('0');
  const [playtimeFilter, setPlaytimeFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  // Form states - Add Expense
  const [expDesc, setExpDesc] = useState('');
  const [expCost, setExpCost] = useState('');
  const [historyExpenses, setHistoryExpenses] = useState([]);

  // Filter and search games
  const filteredGames = games.filter(g => {
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase());
    const matchAcq = acqFilter ? g.acquisition_type === acqFilter : true;
    
    // Playtime Filter
    let matchPlaytime = true;
    const hours = parseFloat(g.total_hours || 0);
    if (playtimeFilter === 'played') {
      matchPlaytime = hours > 0;
    } else if (playtimeFilter === 'unplayed') {
      matchPlaytime = hours === 0;
    } else if (playtimeFilter === 'less_5') {
      matchPlaytime = hours > 0 && hours < 5;
    } else if (playtimeFilter === 'less_10') {
      matchPlaytime = hours > 0 && hours < 10;
    } else if (playtimeFilter === 'less_20') {
      matchPlaytime = hours > 0 && hours < 20;
    }

    // Rating Filter
    let matchRating = true;
    if (ratingFilter === 'default_sliders') {
      const q = g.qualitative || {};
      const isDefault = Object.values(q).every(val => val === 5);
      matchRating = isDefault;
    } else if (ratingFilter === 'no_matches') {
      matchRating = parseInt(g.match_count || 0) === 0;
    } else if (ratingFilter === 'no_score_100') {
      matchRating = g.score_100 === null || g.score_100 === undefined;
    }

    return matchSearch && matchAcq && matchPlaytime && matchRating;
  });

  const sortedGames = [...filteredGames].sort((a, b) => {
    // 1. Recently played / logged time for (most recent last_played_at first)
    const aPlayed = a.last_played_at ? new Date(a.last_played_at).getTime() : 0;
    const bPlayed = b.last_played_at ? new Date(b.last_played_at).getTime() : 0;
    if (aPlayed !== bPlayed) {
      return bPlayed - aPlayed;
    }

    // 2. Recently logged time (total_hours > 0)
    const aHours = parseFloat(a.total_hours || 0);
    const bHours = parseFloat(b.total_hours || 0);
    if ((aHours > 0) !== (bHours > 0)) {
      return bHours > 0 ? -1 : 1;
    }

    // 3. New games added (created_at most recent first)
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) {
      return bCreated - aCreated;
    }

    return (a.title || '').localeCompare(b.title || '');
  });

  const openAddGameModal = () => {
    setTitle('');
    setAcqType('retail');
    setSubId('');
    setBaseCost('0');
    setTotalHoursInput('0');
    setUnplayed(true);
    setHasOpinion(false);
    setPlayMode('single');
    setStatus('playing');
    setScore100('');
    setRecommend('');
    setSelectedCategories([]);
    setSuggestedCategories([]);
    setCustomCategory('');
    setQualitative({
      story: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      multiplayer: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      social: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      mechanics: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      gameplay_loop: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      game_design: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      interfaces: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      graphics: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      challenge: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      relaxation: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      pacing: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      replayability: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false }
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
    setUnplayed(game.unplayed === true || game.unplayed === 1 || game.unplayed === 'true');
    setHasOpinion(game.has_opinion === true || game.has_opinion === 1 || game.has_opinion === 'true' || game.has_opinion === undefined);
    setPlayMode(game.play_mode || 'single');
    setStatus(game.status || 'playing');
    setScore100(game.score_100 !== null && game.score_100 !== undefined ? game.score_100.toString() : '');
    let initialRec = '';
    if (game.recommend === true || game.recommend === 1 || game.recommend === 'true') initialRec = 'true';
    else if (game.recommend === false || game.recommend === 0 || game.recommend === 'false') initialRec = 'false';
    setRecommend(initialRec);
    setSelectedCategories(game.categories || []);
    setSuggestedCategories([]);
    setCustomCategory('');
    setQualitative(game.qualitative || {
      story: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      multiplayer: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      social: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      mechanics: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      gameplay_loop: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      game_design: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      interfaces: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      graphics: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      challenge: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      relaxation: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      pacing: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false },
      replayability: { rating: 5, reason_text: '{}', was_expected: false, is_top_pillar: false }
    });
    setActiveModal('editGame');
  };

  const openLogHoursModal = async (game) => {
    setSelectedGame(game);
    setLogHours('');
    setLogDate(new Date().toISOString().split('T')[0]);
    setIsHistoricalLog(false);
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
          total_hours: 0,
          unplayed: true,
          has_opinion: false,
          play_mode: 'single'
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
          unplayed: parseFloat(totalHoursInput || 0) > 0 ? false : unplayed,
          status,
          score_100: score100 !== '' ? parseInt(score100) : null,
          recommend: recommend !== '' ? (recommend === 'true') : null,
          categories: selectedCategories,
          play_mode: playMode,
          has_opinion: hasOpinion
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
        const updatedHours = addToTotal ? (selectedGame.total_hours + addedHours) : selectedGame.total_hours;
        const updatedGame = {
          ...selectedGame,
          total_hours: updatedHours,
          unplayed: updatedHours > 0 ? false : selectedGame.unplayed
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
        const parsedHours = parseFloat(overallHoursInput || 0);
        const updatedGame = {
          ...selectedGame,
          total_hours: parsedHours,
          unplayed: parsedHours > 0 ? false : selectedGame.unplayed
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

  const handleQualitativeQuestionChange = (key, qId, value) => {
    setQualitative(prev => {
      const q = prev[key] || { rating: null, reason_text: '{}', was_expected: false, is_top_pillar: false };
      let answers = {};
      try {
        answers = JSON.parse(q.reason_text || '{}');
      } catch(e) {}
      answers[qId] = value;
      // Auto-enable 0-10 rating if answering a question (unless explicitly N/A)
      const currentRating = (q.rating === null && value !== 'N/A') ? 5 : (value === 'N/A' && qId === 'impacted_enjoyment' ? null : q.rating);
      return {
        ...prev,
        [key]: { ...q, rating: currentRating, reason_text: JSON.stringify(answers) }
      };
    });
  };

  const handleQualitativeChange = (key, field, val) => {
    setQualitative(prev => {
      const q = prev[key] || { rating: null, reason_text: '{}', was_expected: false, is_top_pillar: false };
      return {
        ...prev,
        [key]: {
          ...q,
          [field]: val
        }
      };
    });
  };

  // Helper labels for sliders
  const PILLAR_QUESTIONS = {
  story: [
    { id: 'understand', text: 'How well did you understand the story?', type: 'scale', min: 0, max: 10 },
    { id: 'impactful', text: 'Was the story impactful to you?', type: 'scale', min: 0, max: 10 },
    { id: 'paced', text: 'How well was the story paced?', type: 'scale', min: 0, max: 10 }
  ],
  multiplayer: [
    { id: 'tech_problems', text: 'Were there technical problems that kept you from enjoying or playing?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'tech_quit', text: 'Were the problems bad enough that you decided to stop playing?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'rewarding_loop', text: 'How rewarding is the multiplayer progression/loop?', type: 'scale', min: 0, max: 10 }
  ],
  social: [
    { id: 'communication', text: 'How well does the game communicate your progress/skill level?', type: 'scale', min: 0, max: 10 },
    { id: 'obtainable', text: 'Do the leaderboards feel obtainable and motivating?', type: 'scale', min: 0, max: 10 }
  ],
  mechanics: [
    { id: 'responsive', text: 'How responsive/fluid do the controls feel?', type: 'scale', min: 0, max: 10 },
    { id: 'intuitive_actions', text: 'How fun and intuitive are the core actions?', type: 'scale', min: 0, max: 10 }
  ],
  gameplay_loop: [
    { id: 'intrinsic', text: 'Intrinsic Satisfaction (Micro Loop): How satisfying is the baseline action?', type: 'scale', min: 0, max: 10 },
    { id: 'reward_economy', text: 'Reward Economy: Do the rewards feel proportional to the effort?', type: 'scale', min: 0, max: 10 },
    { id: 'compulsion', text: 'Compulsion (Macro Loop): How strongly does finishing one cycle make you start the next?', type: 'scale', min: 0, max: 10 },
    { id: 'burnout_threshold', text: 'Burnout Threshold: At what point does the loop start feeling repetitive?', type: 'radio', options: ['Under 30 mins', '1-2 hours', '3+ hours', 'Never'] }
  ],
  game_design: [
    { id: 'agency', text: 'Player Agency: How much freedom do you have to solve problems?', type: 'scale', min: 0, max: 10 },
    { id: 'systemic_depth', text: 'Systemic Depth: How well do different mechanics work together?', type: 'scale', min: 0, max: 10 },
    { id: 'balance', text: 'Balance & Strategic Variety: Did it encourage trying different strategies?', type: 'scale', min: 0, max: 10 }
  ],
  interfaces: [
    { id: 'intuitive_menus', text: 'How intuitive and easy to navigate are the menus?', type: 'scale', min: 0, max: 10 },
    { id: 'hud', text: 'Is the in-game HUD/interface obtrusive or cleanly designed?', type: 'scale', min: 0, max: 10 }
  ],
  graphics: [
    { id: 'cohesive', text: 'How cohesive is the art direction?', type: 'scale', min: 0, max: 10 },
    { id: 'appealing_menus', text: 'Are the menus/interfaces visually appealing?', type: 'radio', options: ['Yes', 'No'] }
  ],
  challenge: [
    { id: 'fair', text: 'How fair did the challenges/deaths feel?', type: 'scale', min: 0, max: 10 },
    { id: 'rewarding_overcome', text: 'How rewarding is it to overcome a difficult obstacle?', type: 'scale', min: 0, max: 10 },
    { id: 'accessibility', text: 'Does the game offer appropriate accessibility/difficulty options?', type: 'radio', options: ['Yes', 'No'] }
  ],
  relaxation: [
    { id: 'unwind', text: 'Do you play this game specifically to unwind?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'calming', text: 'How calming is the games atmosphere/vibe?', type: 'scale', min: 0, max: 10 },
    { id: 'punishing_mistakes', text: 'How punishing are mistakes?', type: 'scale', min: 0, max: 10 },
    { id: 'podcast', text: 'Can you play this game while listening to a podcast?', type: 'radio', options: ['Yes', 'No'] }
  ],
  pacing: [
    { id: 'transition', text: 'How well does the game transition between action and downtime?', type: 'scale', min: 0, max: 10 },
    { id: 'grinding', text: 'How much filler/grinding did you experience?', type: 'scale', min: 0, max: 10 },
    { id: 'respect_time', text: 'Does the game respect your time?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'escalation', text: 'Pacing & Escalation: How well does the game introduce new mechanics over time?', type: 'scale', min: 0, max: 10 }
  ],
  replayability: [
    { id: 'play_again', text: 'Do you see yourself playing this game again in the future?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'replay_frequency', text: 'If Yes, how often would you replay it?', type: 'radio', options: ['Daily/Weekly', 'Monthly', 'Annually', 'Rarely'] },
    { id: 'variety', text: 'Does the game offer enough variety to warrant multiple playthroughs?', type: 'scale', min: 0, max: 10 }
  ]
};

const pillarLabels = {
    story: 'Story/Narrative',
    multiplayer: 'Multiplayer',
    social: 'Community/Social',
    mechanics: 'Gameplay Mechanics',
    gameplay_loop: 'Gameplay Loop',
    game_design: 'Game Design',
    interfaces: 'Interfaces & Menus',
    graphics: 'Graphics/Visuals',
    challenge: 'Challenge/Difficulty',
    relaxation: 'Relaxation/Chill Factor',
    pacing: 'Pacing/Flow',
    replayability: 'Replayability'
  };

  const [expandedPillar, setExpandedPillar] = useState(null);

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
          style={{ width: 'auto', minWidth: '140px' }}
          value={acqFilter}
          onChange={(e) => setAcqFilter(e.target.value)}
        >
          <option value="">All Models</option>
          <option value="retail">Retail Purchase</option>
          <option value="subscription">Subscription Game</option>
          <option value="free">Completely Free</option>
          <option value="f2p">Free to Play</option>
        </select>

        <select
          className="form-input form-select"
          style={{ width: 'auto', minWidth: '140px' }}
          value={playtimeFilter}
          onChange={(e) => setPlaytimeFilter(e.target.value)}
        >
          <option value="all">All Playtimes</option>
          <option value="played">Played Games</option>
          <option value="unplayed">Unplayed Games</option>
          <option value="less_5">Played &lt; 5 Hours</option>
          <option value="less_10">Played &lt; 10 Hours</option>
          <option value="less_20">Played &lt; 20 Hours</option>
        </select>

        <select
          className="form-input form-select"
          style={{ width: 'auto', minWidth: '140px' }}
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
        >
          <option value="all">All Ratings</option>
          <option value="default_sliders">Unrated Sliders</option>
          <option value="no_matches">0 Arena Matches</option>
          <option value="no_score_100">No Final Score</option>
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
          {sortedGames.map(game => (
            <div key={game.game_id} className={`glass-panel game-card ${game.acquisition_type}`}>
              <div>
                <div className="game-card-header">
                  <h3 className="game-card-title">{game.title}</h3>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {game.unplayed && game.total_hours === 0 ? (
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
                    <span className="status-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {game.play_mode === 'both' ? 'Solo & Multi' : (game.play_mode === 'multi' ? 'Multi' : 'Solo')}
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
                    <span className="sub-stat-value" style={game.total_hours > 0 && game.total_hours < 1 ? { color: '#f87171' } : {}}>
                      {game.total_hours.toFixed(1)}h
                    </span>
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
                {!game.unplayed && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary)' }}>
                      <Star size={10} fill="var(--primary)" />
                      <span>Elo: {game.elo_rating}</span>
                    </div>
                    {Boolean(game.has_opinion) && game.qualitative && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--secondary)' }}>
                          <Sparkles size={10} />
                          <span>Story: {game.qualitative.story?.rating ?? 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)' }}>
                          <Sparkles size={10} />
                          <span>Mechs: {game.qualitative.mechanics?.rating ?? 'N/A'}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Finished review details */}
                {!game.unplayed && (
                  <div className="review-highlight-row">
                    {game.has_opinion ? (
                      game.score_100 !== null ? (
                        <div className="review-highlight-item" style={{ color: '#a78bfa' }}>
                          <CheckCircle size={10} />
                          <span>Score: {game.score_100}/100</span>
                        </div>
                      ) : (
                        <div className="review-highlight-item" style={{ color: '#a78bfa' }}>
                          <CheckCircle size={10} />
                          <span>Score: TBD</span>
                        </div>
                      )
                    ) : (
                      <div className="review-highlight-item" style={{ color: 'var(--text-muted)' }}>
                        <CheckCircle size={10} />
                        <span>Score: Unrated</span>
                      </div>
                    )}
                    
                    {Boolean(game.has_opinion) && game.recommend !== null && (
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
                    <span>Add-on / DLC</span>
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
                    value={subId ? `sub-${subId}` : acqType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('sub-')) {
                        setAcqType('subscription');
                        setSubId(val.replace('sub-', ''));
                      } else {
                        setAcqType(val);
                        setSubId('');
                      }
                    }}
                  >
                    <option value="retail">Retail Purchase</option>
                    <option value="free">Completely Free</option>
                    <option value="f2p">Free to Play (F2P)</option>
                    {subscriptions.filter(s => !!s.is_active).map(s => (
                      <option key={s.subscription_id} value={`sub-${s.subscription_id}`}>
                        Subscription: {s.name} (${parseFloat(s.cost || s.monthly_cost || 0).toFixed(2)}/{s.billing_cycle === 'yearly' ? 'yr' : 'mo'})
                      </option>
                    ))}
                  </select>
                </div>

                {acqType === 'retail' && (
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
                )}

                {activeModal === 'editGame' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Play Mode</label>
                      <select
                        className="form-input form-select"
                        value={playMode}
                        onChange={(e) => setPlayMode(e.target.value)}
                      >
                        <option value="single">Single Player Only</option>
                        <option value="multi">Multiplayer Only</option>
                        <option value="both">Both (Single & Multiplayer)</option>
                      </select>
                    </div>

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
                  </>
                )}
              </div>

              {/* Unplayed Toggle (only in edit modal when total playtime is 0) */}
              {activeModal === 'editGame' && parseFloat(totalHoursInput || 0) === 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={unplayed}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setUnplayed(val);
                        if (val) setHasOpinion(false); // unplayed games skip opinion
                      }}
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


              {/* Status, Surveys, and Categories tags */}
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

                  {/* Recommendations section */}
                  {!unplayed && (
                    <div className="form-grid" style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', rowGap: '12px' }}>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Would you recommend this game to others?</label>
                        <select
                          className="form-input form-select"
                          value={recommend}
                          onChange={(e) => setRecommend(e.target.value)}
                          style={{ marginTop: '8px' }}
                        >
                          <option value="">Not sure yet</option>
                          <option value="true">Yes, definitely</option>
                          <option value="false">No, not really</option>
                        </select>
                      </div>
                    </div>
                  )}

              {/* Qualitative Attribute Profiling Deep Dive */}
              {!unplayed && (
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '24px' }}>
                  
                  {/* Rate this game toggle */}
                  <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 12px 0' }}>
                      <Sparkles size={16} />
                      Who is this game for and why?
                    </h3>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Would you like to rate this game?</label>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="radio"
                            name="has_opinion"
                            value="true"
                            checked={hasOpinion === true}
                            onChange={() => setHasOpinion(true)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          Yes
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="radio"
                            name="has_opinion"
                            value="false"
                            checked={hasOpinion === false}
                            onChange={() => setHasOpinion(false)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          Not yet
                        </label>
                      </div>
                      {hasOpinion === false && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                          <strong>NOT YET:</strong> Excludes this game from Pairwise Joy matchmaking and qualitative slider ratings, but retains it in CPH calculation.
                        </p>
                      )}
                    </div>
                  </div>

                  {hasOpinion === true && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                          Overall Score: {(() => {
                            let totalWeightedScore = 0;
                            let totalMaxWeight = 0;
                            Object.keys(pillarLabels).forEach(key => {
                              const p = qualitative[key];
                              if (p && p.rating !== null && p.rating !== '') {
                                const r = parseInt(p.rating);
                                const weight = p.is_top_pillar ? 2 : 1;
                                
                                let modifier = 0;
                                let answers = {};
                                try { answers = JSON.parse(p.reason_text || '{}'); } catch(e) {}
                                
                                // Expectation Matrix
                                if (p.was_expected) {
                                  const expectedQual = parseInt(answers.expected_quality);
                                  if (!isNaN(expectedQual)) {
                                    const isExpectedHigh = expectedQual >= 7;
                                    const isExpectedLow = expectedQual <= 4;
                                    const isActualHigh = r >= 7;
                                    const isActualLow = r <= 4;
                                    
                                    if (isExpectedLow && isActualHigh) modifier += 10;
                                    else if (isExpectedHigh && isActualHigh) modifier += 0;
                                    else if (isExpectedHigh && isActualLow) modifier -= 20;
                                    else if (isExpectedLow && isActualLow) modifier -= 5;
                                  }
                                } else {
                                  const isActualHigh = r >= 7;
                                  if (isActualHigh) modifier += 15;
                                }
                                
                                // Sub-questions
                                for (const [k, val] of Object.entries(answers)) {
                                  if (k === 'expected_quality' || k === 'impacted_enjoyment' || k === 'burnout_threshold' || k === 'replay_frequency') continue;
                                  const numVal = parseFloat(val);
                                  if (!isNaN(numVal)) {
                                    modifier += (numVal - 5) * 1;
                                  } else if (val === 'Yes' || val === 'yes' || val === true) {
                                    modifier += 2;
                                  } else if (val === 'No' || val === 'no' || val === false) {
                                    modifier -= 2;
                                  }
                                }

                                let baseCatScore = r * 10;
                                let finalCatScore = baseCatScore + modifier;
                                finalCatScore = Math.max(0, Math.min(100, finalCatScore));

                                totalWeightedScore += (finalCatScore * weight);
                                totalMaxWeight += (100 * weight);
                              }
                            });
                            return totalMaxWeight > 0 ? `${Math.round((totalWeightedScore / totalMaxWeight) * 100)}/100` : 'TBD';
                          })()}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(pillarLabels).map(key => {
                      const pData = qualitative[key] || { rating: null, reason_text: '{}', was_expected: false, is_top_pillar: false };
                      const isExpanded = expandedPillar === key;
                      const hasRating = pData.rating !== null && pData.rating !== '';
                      
                      let answers = {};
                      try {
                        answers = JSON.parse(pData.reason_text || '{}');
                      } catch(e) {}
                      
                      return (
                        <div key={key} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div 
                            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}
                            onClick={() => setExpandedPillar(isExpanded ? null : key)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: '600', color: hasRating ? '#fff' : 'var(--text-muted)' }}>{pillarLabels[key]}</span>
                              {pData.is_top_pillar && (
                                <span style={{ 
                                  background: 'var(--accent-glow)', 
                                  color: 'var(--accent)', 
                                  fontSize: '0.7rem', 
                                  padding: '4px 10px', 
                                  borderRadius: '20px',
                                  border: '1px solid var(--accent)',
                                  fontWeight: '600',
                                  letterSpacing: '0.02em',
                                  boxShadow: '0 0 10px var(--accent-glow)'
                                }}>
                                  Top Pillar (2x)
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontWeight: 'bold', color: hasRating ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {hasRating ? `${pData.rating}/10` : 'N/A'}
                              </span>
                              <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex' }}>
                                <ChevronDown size={16} />
                              </span>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                              
                              <div className="form-group" style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <label className="form-label" style={{ margin: 0 }}>Rating (0-10)</label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <input 
                                      type="checkbox"
                                      checked={!hasRating}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          handleQualitativeChange(key, 'rating', null);
                                        } else {
                                          handleQualitativeChange(key, 'rating', 5);
                                        }
                                      }}
                                      style={{ accentColor: 'var(--primary)' }}
                                    />
                                    Mark as N/A (Does Not Apply)
                                  </label>
                                </div>
                                {!hasRating ? (
                                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px dashed var(--border-color)' }}>
                                    <span>Pillar currently marked N/A.</span>
                                    <button 
                                      type="button" 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 12px', fontSize: '0.8rem', width: 'auto' }}
                                      onClick={() => handleQualitativeChange(key, 'rating', 5)}
                                    >
                                      Enable 0-10 Rating
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <input
                                      type="range"
                                      min="0"
                                      max="10"
                                      className="custom-range-slider"
                                      style={{ flex: 1 }}
                                      value={pData.rating ?? 5}
                                      onChange={(e) => handleQualitativeChange(key, 'rating', e.target.value)}
                                    />
                                    <span style={{ fontWeight: 'bold', width: '40px', textAlign: 'right', color: 'var(--primary)' }}>{pData.rating}/10</span>
                                  </div>
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.88rem', marginBottom: '6px', color: '#fff', fontWeight: '500' }}>
                                    Did {pillarLabels[key]} impact your overall enjoyment of the game?
                                  </label>
                                  <div style={{ display: 'flex', gap: '14px', marginBottom: '4px' }}>
                                    {['Yes', 'No', 'N/A'].map(opt => (
                                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        <input 
                                          type="radio" 
                                          name={`${key}_impacted_enjoyment`} 
                                          value={opt} 
                                          checked={answers.impacted_enjoyment === opt || (opt === 'Yes' && answers.impacted_enjoyment === true) || (opt === 'No' && answers.impacted_enjoyment === false)} 
                                          onChange={(e) => handleQualitativeQuestionChange(key, 'impacted_enjoyment', e.target.value)}
                                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                                        />
                                        {opt}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '0.88rem', marginBottom: '6px', color: '#fff', fontWeight: '500' }}>
                                    {pillarLabels[key]} was something I was specifically looking for when I chose to play this game.
                                  </label>
                                  <div style={{ display: 'flex', gap: '14px', marginBottom: '4px' }}>
                                    {['Yes', 'No', 'N/A'].map(opt => (
                                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        <input 
                                          type="radio" 
                                          name={`${key}_was_expected`} 
                                          value={opt} 
                                          checked={(opt === 'Yes' && pData.was_expected === true) || (opt === 'No' && pData.was_expected === false) || (opt === 'N/A' && (pData.was_expected === 'N/A' || pData.was_expected === null))} 
                                          onChange={(e) => handleQualitativeChange(key, 'was_expected', e.target.value === 'Yes' ? true : (e.target.value === 'No' ? false : 'N/A'))}
                                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                                        />
                                        {opt}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                
                                {pData.was_expected === true && (
                                  <div style={{ marginLeft: '24px', marginBottom: '8px' }}>
                                    <label style={{ display: 'block', fontSize: '0.88rem', marginBottom: '6px', color: '#fff', fontWeight: '500' }}>
                                      What quality of {pillarLabels[key]} did you expect?
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="10" 
                                        value={answers.expected_quality ?? 5}
                                        onChange={(e) => handleQualitativeQuestionChange(key, 'expected_quality', e.target.value)}
                                        className="custom-range-slider"
                                        style={{ width: '150px' }}
                                      />
                                      <span style={{ fontSize: '0.85rem' }}>{answers.expected_quality ?? 5}/10</span>
                                    </div>
                                  </div>
                                )}

                                {PILLAR_QUESTIONS[key]?.map(q => (
                                  <div key={q.id} style={{ marginLeft: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>{q.text}</label>
                                    {q.type === 'radio' && (
                                      <div style={{ display: 'flex', gap: '12px' }}>
                                        {q.options.map(opt => (
                                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                            <input 
                                              type="radio" 
                                              name={`${key}_${q.id}`} 
                                              value={opt} 
                                              checked={answers[q.id] === opt}
                                              onChange={(e) => handleQualitativeQuestionChange(key, q.id, e.target.value)}
                                              style={{ accentColor: 'var(--primary)' }}
                                            />
                                            {opt}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                    {q.type === 'scale' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input 
                                          type="range" 
                                          min={q.min} 
                                          max={q.max} 
                                          value={answers[q.id] || q.min}
                                          onChange={(e) => handleQualitativeQuestionChange(key, q.id, e.target.value)}
                                          className="custom-range-slider"
                                          style={{ width: '150px' }}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>{answers[q.id] || q.min}/{q.max}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}

                                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', marginTop: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={pData.is_top_pillar || false} 
                                    onChange={(e) => handleQualitativeChange(key, 'is_top_pillar', e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                                  />
                                  This is one of the Top 3-5 defining pillars for this game. (2x Weight)
                                </label>
                                
                                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-muted)', marginTop: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={!hasRating} 
                                    onChange={(e) => handleQualitativeChange(key, 'rating', e.target.checked ? null : 5)}
                                    style={{ accentColor: 'var(--primary)' }}
                                  />
                                  Mark {pillarLabels[key]} as N/A (Does not apply)
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
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
                    disabled={isHistoricalLog}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '-4px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={isHistoricalLog}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsHistoricalLog(checked);
                      if (checked) {
                        setLogDate('2000-01-01');
                      } else {
                        setLogDate(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Historical Log / Don't remember date (Keeps out of "Played This Week")</span>
                </label>
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
                <h2 style={{ fontSize: '1.25rem' }}>Add DLC, In-game Purchase, or Battle Pass</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedGame?.title}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpense}>
              <div className="form-group">
                <label className="form-label">Item Name / Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Expansion Pass, Battle Pass, 1000 Coins"
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
                <div className="no-data-msg" style={{ padding: '20px' }}>No purchases recorded yet.</div>
              ) : (
                <div className="list-wrapper">
                  {historyExpenses.map(purchase => (
                    <div key={purchase.purchase_id} className="list-item">
                      <div>
                        <div className="list-item-title">{purchase.description}</div>
                        <div className="list-item-sub">
                          {purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontWeight: '600' }}>
                          ${parseFloat(purchase.cost || 0).toFixed(2)}
                        </span>
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
