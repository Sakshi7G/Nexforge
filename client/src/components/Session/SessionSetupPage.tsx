import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ThemeToggle } from '../Common/ThemeToggle';
import { Code2, Play, Copy, Check, Link, Home, User, Mail, Shield, ArrowRight } from 'lucide-react';

interface SessionSetupPageProps {
  initialRoomId?: string;
  onJoinSession: (name: string, email: string, roomNameOrId: string, role: string) => void;
  onReturnHome: () => void;
}

export const SessionSetupPage: React.FC<SessionSetupPageProps> = ({
  initialRoomId = '',
  onJoinSession,
  onReturnHome
}) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [roomInput, setRoomInput] = useState(initialRoomId || '');
  const [role, setRole] = useState<'editor' | 'viewer' | 'admin'>('editor');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialRoomId) {
      setRoomInput(initialRoomId);
    }
  }, [initialRoomId]);

  useEffect(() => {
    if (user) {
      if (!name) setName(user.name);
      if (!email) setEmail(user.email);
    }
  }, [user]);

  // Extract clean room ID if user pasted full URL like http://localhost:3000?room=123
  const getCleanRoomId = (input: string) => {
    if (!input) return 'room_' + Math.random().toString(36).substring(2, 8);
    if (input.includes('?room=')) {
      const parts = input.split('?room=');
      return parts[1] || input;
    }
    return input.trim();
  };

  const handleCopyLink = () => {
    const cleanId = getCleanRoomId(roomInput);
    const fullUrl = `${window.location.origin}?room=${cleanId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoom = getCleanRoomId(roomInput);
    onJoinSession(name || 'Guest User', email || 'guest@nexforge.dev', cleanRoom, role);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Navbar */}
      <nav className="glass-panel" style={{
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={onReturnHome}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Code2 size={20} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '20px' }} className="gradient-text">
            NexForge
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle variant="full" />
          <button onClick={onReturnHome} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Home size={15} /> Back to Home
          </button>
        </div>
      </nav>

      {/* Main Setup Card Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px'
      }}>
        <div className="glass-panel animate-fade-in" style={{
          width: '520px',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'var(--bg-tertiary)',
              color: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <Play size={24} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700 }}>
              Join or Create Session
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Configure your details & room link to enter the real-time IDE.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* User Name */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                <User size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Your Display Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Alex Mercer"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            {/* User Email */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                <Mail size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Your Email Address
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="alex@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Room ID or Shared Link */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <Link size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Session Name / Room ID / Shared Link
                </label>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedLink ? <Check size={12} color="var(--status-success)" /> : <Copy size={12} />}
                  {copiedLink ? 'Copied Share Link!' : 'Copy Share Link'}
                </button>
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="Paste Room ID (e.g. room_9a8f) or full share link..."
                value={roomInput}
                onChange={e => setRoomInput(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Leave empty to automatically spin up a brand new room.
              </span>
            </div>

            {/* Role Selector */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                <Shield size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Your Room Permission Role
              </label>
              <select
                className="input-field"
                value={role}
                onChange={e => setRole(e.target.value as any)}
              >
                <option value="editor">Editor (Can edit code, run terminal & chat)</option>
                <option value="admin">Admin / Owner (Full workspace management)</option>
                <option value="viewer">Viewer (Read-only observation mode)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
              >
                {copiedLink ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
                {copiedLink ? 'Link Copied' : 'Share Link'}
              </button>

              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 1.5, justifyContent: 'center', padding: '12px', fontSize: '15px' }}
              >
                Join Session <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
