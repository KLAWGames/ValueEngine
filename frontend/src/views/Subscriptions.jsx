import React, { useState } from 'react';
import { CreditCard, Plus, Edit, Trash2, ToggleLeft, ToggleRight, X, AlertCircle } from 'lucide-react';

function Subscriptions({ token, subscriptions, onRefresh }) {
  const [activeModal, setActiveModal] = useState(null); // 'addSub' | 'editSub'
  const [selectedSub, setSelectedSub] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setName('');
    setCost('');
    setIsActive(true);
    setActiveModal('addSub');
  };

  const openEditModal = (sub) => {
    setSelectedSub(sub);
    setName(sub.name);
    setCost(sub.monthly_cost.toString());
    setIsActive(sub.is_active === 1);
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
          monthly_cost: parseFloat(cost),
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
          monthly_cost: parseFloat(cost),
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
          is_active: sub.is_active === 1 ? false : true
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
          {subscriptions.map(sub => (
            <div key={sub.subscription_id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifycontent: 'space-between', minHeight: '180px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{sub.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: sub.is_active === 1 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '600' }}>
                      {sub.is_active === 1 ? '● Billing Active' : '○ Billing Suspended'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>
                    ${sub.monthly_cost.toFixed(2)}/mo
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button 
                  className="card-action-btn"
                  onClick={() => handleToggleActive(sub)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {sub.is_active === 1 ? (
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
          ))}
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

              <div className="form-group">
                <label className="form-label">Monthly Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="e.g. 16.99"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required
                />
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
