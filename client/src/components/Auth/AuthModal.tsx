import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Code2, Sparkles, LogIn, UserPlus } from 'lucide-react';

interface AuthModalProps {
  initialIsLogin?: boolean;
  initialName?: string;
  initialEmail?: string;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialIsLogin = false,
  initialName = '',
  initialEmail = '',
  onClose
}) => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '420px',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'var(--accent-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
          }}>
            <Code2 size={32} color="#fff" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', marginTop: '12px' }}>
            Welcome to <span className="gradient-text">NexForge</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            AI-Powered Real-Time Collaborative IDE
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-primary)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              background: isLogin ? 'var(--bg-tertiary)' : 'transparent',
              color: isLogin ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Log In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              background: !isLogin ? 'var(--bg-tertiary)' : 'transparent',
              color: !isLogin ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Guidance message for invited / new users */}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {isLogin ? (
            <span>Existing user? Log in with your password. New / Invited user? Click <strong>Sign Up</strong>.</span>
          ) : (
            <span>Invited or New user? Enter your name, email & choose a password to join!</span>
          )}
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid var(--status-error)',
            color: '#fda4af',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Alex Mercer"
                value={name}
                onChange={e => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="alex@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px',
              marginTop: '8px',
              fontSize: '15px'
            }}
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : isLogin ? (
              <>
                <LogIn size={18} />
                Log In to IDE
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Create Account
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--accent-primary)' }} />
          Multi-user CRDT sync & Gemini AI enabled
        </div>
      </div>
    </div>
  );
};
