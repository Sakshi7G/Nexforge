import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import { UserPlus, X, Check, Copy, Link, Wifi, Globe, Loader2 } from 'lucide-react';

interface ShareModalProps {
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ onClose }) => {
  const { activeWorkspace } = useWorkspace();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [lastInvitedEmail, setLastInvitedEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [lanAppUrl, setLanAppUrl] = useState('');
  const [publicTunnelUrl, setPublicTunnelUrl] = useState('');
  const [tunnelStatus, setTunnelStatus] = useState<'connecting' | 'connected' | 'idle' | 'error'>('connecting');

  useEffect(() => {
    let intervalId: any = null;

    const fetchNetworkInfo = () => {
      api.get('/workspaces/lan-info')
        .then(res => {
          if (res.data?.publicTunnelUrl) {
            setPublicTunnelUrl(res.data.publicTunnelUrl);
          }
          if (res.data?.appUrl) {
            setLanAppUrl(res.data.appUrl);
          }
          if (res.data?.status) {
            setTunnelStatus(res.data.status);
          }
        })
        .catch(() => {});
    };

    fetchNetworkInfo();
    intervalId = setInterval(fetchNetworkInfo, 2500);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const isCloudOrigin = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.startsWith('192.168.') &&
    !window.location.hostname.startsWith('10.');

  const baseUrl = isCloudOrigin
    ? window.location.origin
    : (publicTunnelUrl || lanAppUrl || window.location.origin);
  const roomUrl = activeWorkspace ? `${baseUrl}?room=${activeWorkspace.id}` : '';

  const handleCopyLink = () => {
    if (roomUrl) {
      navigator.clipboard.writeText(roomUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. teammate@company.com)');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');
    setPreviewUrl('');
    setLastInvitedEmail(cleanEmail);
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/members`, { email: cleanEmail, role });
      setMessage(res.data.message || `Successfully invited ${cleanEmail} as ${role}!`);
      if (res.data.previewUrl) setPreviewUrl(res.data.previewUrl);
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to invite user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '460px',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        border: '1px solid var(--glass-border-light)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Share Room & Invite Team</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* 1. Direct Shareable Worldwide Link Box */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} color="#10b981" />
              Worldwide Public Link (Join from any Wi-Fi)
            </label>
            {isCloudOrigin ? (
              <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                Worldwide Cloud Active
              </span>
            ) : publicTunnelUrl ? (
              <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                Worldwide Tunnel Active
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
                Local Network (Wi-Fi)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="input-field"
              style={{ fontSize: '12px', fontFamily: "'Fira Code', monospace" }}
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn-primary"
              style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '13px' }}
            >
              {copiedLink ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              {copiedLink ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {message && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--status-success)', color: '#a7f3d0', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} color="#10b981" />
              <span>{message}</span>
            </div>
            {lastInvitedEmail && (
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lastInvitedEmail)}&su=${encodeURIComponent(`Invitation to join ${activeWorkspace?.name || 'Workspace'} on NexForge`)}&body=${encodeURIComponent(`Hello!\n\nYou have been invited to collaborate on "${activeWorkspace?.name || 'Workspace'}" on NexForge.\n\nJoin Link: ${roomUrl}\n\nHappy coding!\n- NexForge Team`)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ea4335',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  width: 'fit-content'
                }}
              >
                ✉️ Open in Gmail to Send Direct to {lastInvitedEmail}
              </a>
            )}
            {previewUrl && (
              <div style={{ fontSize: '11px', color: '#6ee7b7', marginTop: '4px' }}>
                🌐 Development Email Web Preview: <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: '#ffffff', textDecoration: 'underline' }}>View Sent Email online</a>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--status-error)', color: '#fda4af', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* 2. Invite by Email Form */}
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Invite Member by Email Address
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="teammate@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Permission Role
            </label>
            <select
              className="input-field"
              value={role}
              onChange={e => setRole(e.target.value as any)}
            >
              <option value="editor">Editor (Full edit & execute permissions)</option>
              <option value="viewer">Viewer (Read-only access)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const targetEmail = email.trim().toLowerCase() || lastInvitedEmail;
                if (!targetEmail) {
                  setError('Please enter an email address first');
                  return;
                }
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(`Invitation to join ${activeWorkspace?.name || 'Workspace'} on NexForge`)}&body=${encodeURIComponent(`Hello!\n\nYou have been invited to collaborate on "${activeWorkspace?.name || 'Workspace'}" on NexForge.\n\nJoin Link: ${roomUrl}\n\nHappy coding!\n- NexForge Team`)}`;
                window.open(gmailUrl, '_blank');
              }}
              style={{
                background: 'rgba(234, 67, 53, 0.15)',
                border: '1px solid rgba(234, 67, 53, 0.4)',
                color: '#f87171',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ✉️ Send via Gmail
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending Invite...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
