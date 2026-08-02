import React, { useState } from 'react';
import { LogIn, UserPlus, ShieldAlert, Gamepad2, Send, ArrowLeft, CheckCircle2 } from 'lucide-react';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        onLogin(data.token, data.user);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (e) {
      setError('Connection to backend failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      // Even if not ok, we don't leak user existence for security,
      // but if we get a 500 error we should probably show it
      if (res.ok) {
        setResetSuccess(true);
      } else {
        setError(data.error || 'Failed to request reset');
      }
    } catch (e) {
      setError('Connection to backend failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-panel auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--primary)' }}>
            <Gamepad2 size={48} />
          </div>
          <h1>{showForgotPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Register')}</h1>
          <p>{showForgotPassword ? 'Enter your email to receive a reset link' : 'Value Engine & Game Ledger'}</p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            color: 'var(--danger)',
            fontSize: '0.9rem',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {showForgotPassword ? (
          resetSuccess ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: '16px' }}>
                <CheckCircle2 size={48} />
              </div>
              <h2 style={{ marginBottom: '12px', fontSize: '1.2rem' }}>Check your email</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
                If an account exists with {email}, we have sent a password reset link to it. The link will expire in 1 hour.
              </p>
              <button 
                type="button" 
                className="btn" 
                style={{ width: '100%' }}
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSuccess(false);
                }}
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
                {loading ? 'Sending...' : (
                  <>
                    <Send size={18} />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button 
                  type="button"
                  className="header-action-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
                  onClick={() => setShowForgotPassword(false)}
                >
                  <ArrowLeft size={14} /> Back to login
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              {isLogin && (
                <span 
                  style={{ fontSize: '0.8rem', color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError('');
                  }}
                >
                  Forgot Password?
                </span>
              )}
            </div>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Processing...' : (
              isLogin ? (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              )
            )}
          </button>
        </form>
        )}

        {!showForgotPassword && (
          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <span
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }}
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
            >
              {isLogin ? 'Register now' : 'Sign in here'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Auth;
