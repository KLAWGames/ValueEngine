import React, { useState } from 'react';
import { CreditCard, Plus, Edit, Trash2, ToggleLeft, ToggleRight, X, AlertCircle } from 'lucide-react';

function Subscriptions({ token, subscriptions, games = [], onRefresh }) {
  const [activeModal, setActiveModal] = useState(null); // 'addSub' | 'editSub'
  const [selectedSub, setSelectedSub] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setName('');
    setCost('');
    setBillingCycle('monthly');
    setIsActive(true);
    setActiveModal('addSub');
  };

  const openEditModal = (sub) => {
    setSelectedSub(sub);
    setName(sub.name);
    setCost((sub.cost || sub.monthly_cost).toString());
    setBillingCycle(sub.billing_cycle || 'monthly');
    setIsActive(!!sub.is_active);
    setActiveModal('editSub');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          cost: parseFloat(cost),
          billing_cycle: billingCycle,
          is_active: isActive
        })
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create subscription');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/subscriptions/${selectedSub.subscription_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          cost: parseFloat(cost),
          billing_cycle: billingCycle,
          is_active: isActive
        })
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update subscription');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (subId) => {
    if (!window.confirm('Are you sure you want to delete this subscription? Games linked to this service will default to standalone free status, and amortized records will adjust.')) {
      return;
    }

    try {
      const res = await fetch(`/api/subscriptions/${subId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onRefresh();
      } else {
        alert('Failed to delete subscription');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleActive = async (sub) => {
    try {
      const res = await fetch(`/api/subscriptions/${sub.subscription_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_active: !sub.is_active
        })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div className="panel-header" style={{ marginBottom: '24px' }}>
        <h2>
          <CreditCard size={22} className="purple" />
          Subscription Registry
        </h2>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddModal}>
          <Plus size={18} />
          <span>Add Subscription</span>
        </button>
      </div>

      {/* Overview explanation card */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start', borderLeft: '4px solid var(--secondary)' }}>
        <AlertCircle size={24} style={{ color: 'var(--secondary)', flex: 'none' }} />
        <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
          <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Amortization & Time Allocation</strong>
          When you link games to a subscription registry (e.g. Xbox Game Pass, PlayStation Plus), the Value Engine tracks how much that service costs you per month. During active billing months:
          <ul style={{ paddingLeft: '20px', margin: '8px 0', color: 'var(--text-secondary)' }}>
            <li>The subscription fee is allocated proportionally to games played in that month based on session hours.</li>
            <li>If you log play sessions on Game A for 6 hours and Game B for 4 hours, Game A absorbs 60% of the cost, and Game B absorbs 40%.</li>
            <li>If a billing month passes with 0 hours logged across all linked games, that month's entire fee is marked as <strong>Subscription Waste</strong>.</li>
          </ul>
        </div>
      </div>

      {/* Grid List */}
      {subscriptions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <CreditCard size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No subscription services registered. Add a service (like Xbox Game Pass or PlayStation Plus) to begin cataloging subscription games!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {subscriptions.map(sub => {
            const subGames = games.filter(g => g.subscription_id === sub.subscription_id);
            const totalHours = subGames.reduce((acc, g) => acc + parseFloat(g.overall_hours || g.total_hours || 0), 0);
            const gameCount = subGames.length;
            const subCost = parseFloat(sub.cost || sub.monthly_cost || 0);
            const subCycle = sub.billing_cycle || 'monthly';
            const isSubActive = !!sub.is_active;

            const getCostEfficiencyGrade = (hours, monthlyCost) => {
              if (!isSubActive) return { grade: 'Billing Suspended', color: 'var(--text-muted)' };
              if (hours === 0) return { grade: 'F (Unused Waste)', color: '#f87171' };
              const yieldRatio = monthlyCost / hours;
              if (yieldRatio > 3.0) return { grade: 'D (Poor Value)', color: '#fca5a5' };
              if (yieldRatio > 1.5) return { grade: 'C (Average Value)', color: 'var(--text-secondary)' };
              if (yieldRatio > 0.75) return { grade: 'B (Good Value)', color: 'var(--accent)' };
              return { grade: 'A+ (Elite Value)', color: '#34d399' };
            };

            const efficiency = getCostEfficiencyGrade(totalHours, parseFloat(sub.monthly_cost));

            return (
              <div key={sub.subscription_id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '240px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '4px', fontWeight: 'bold' }}>{sub.name}</h3>
                      <span style={{ fontSize: '0.8rem', color: isSubActive ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '600' }}>
                        {isSubActive ? '● Billing Active' : '○ Billing Suspended'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>
                        ${subCost.toFixed(2)}/{subCycle === 'yearly' ? 'yr' : 'mo'}
                      </div>
                      {subCycle === 'yearly' && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          (equiv. ${parseFloat(sub.monthly_cost).toFixed(2)}/mo)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Efficiency and playtime statistics */}
                  <div className="sub-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Games Logged</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>{gameCount}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Hours</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>{totalHours.toFixed(1)} hrs</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Value Efficiency</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: '800', color: efficiency.color }}>{efficiency.grade}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button 
                    className="card-action-btn"
                    onClick={() => handleToggleActive(sub)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isSubActive ? (
                      <>
                        <ToggleRight size={18} style={{ color: 'var(--accent)' }} />
                        <span>Suspend</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={18} style={{ color: 'var(--text-muted)' }} />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                  <button className="card-action-btn" onClick={() => openEditModal(sub)}>
                    <Edit size={14} />
                    <span>Edit</span>
                  </button>
                  <button className="card-action-btn" style={{ flex: 'none', width: '38px', color: 'var(--danger)' }} onClick={() => handleDelete(sub.subscription_id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ADD / EDIT SUBSCRIPTION MODAL --- */}
      {(activeModal === 'addSub' || activeModal === 'editSub') && (
        <div className="modal-backdrop">
          <div className="glass-panel modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-title-row">
              <h2>{activeModal === 'addSub' ? 'Add Subscription' : 'Edit Subscription'}</h2>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={activeModal === 'addSub' ? handleCreate : handleUpdate}>
              <div className="form-group">
                <label className="form-label">Service Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Xbox Game Pass Ultimate"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Billing Cycle</label>
                  <select
                    className="form-input form-select"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                  >
                    <option value="monthly">Monthly Billing</option>
                    <option value="yearly">Yearly Billing</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder={billingCycle === 'yearly' ? 'e.g. 159.99' : 'e.g. 16.99'}
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  id="isActive"
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label htmlFor="isActive" className="form-label" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                  Billing Active (calculates amortization cost & waste)
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {activeModal === 'addSub' ? 'Add Service' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Subscriptions;
