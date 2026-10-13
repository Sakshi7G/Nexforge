import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ThemeToggle } from '../Common/ThemeToggle';
import api from '../../api/client';
import { Code2, Play, UserPlus, Video, Plus, ChevronDown, LogOut, Check, Link, Home } from 'lucide-react';

interface TopNavbarProps {
  onOpenNewWorkspace: () => void;
  onOpenShareModal: () => void;
  onRunCode: () => void;
  onToggleVideoCall: () => void;
  onReturnHome: () => void;
  isVideoCallActive: boolean;
  activeVideoCount: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onOpenNewWorkspace,
  onOpenShareModal,
  onRunCode,
  onToggleVideoCall,
  onReturnHome,
  isVideoCallActive,
  activeVideoCount
}) => {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspace, selectWorkspace, presence } = useWorkspace();

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [publicTunnelUrl, setPublicTunnelUrl] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/workspaces/lan-info')
      .then(res => {
        if (res.data?.publicTunnelUrl) {
          setPublicTunnelUrl(res.data.publicTunnelUrl);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    onReturnHome();
  };

  const handleCopyRoomLink = () => {
    if (!activeWorkspace) return;
    const baseUrl = publicTunnelUrl || window.location.origin;
    const roomUrl = `${baseUrl}?room=${activeWorkspace.id}`;
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const userRole = activeWorkspace?.ownerId === user?.id ? 'Admin' : 'Editor';

  return (
    <header className="glass-panel" style={{
      height: 'var(--header-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
      borderBottom: '1px solid var(--border-color)'
    }}>
      {/* Brand & Workspace Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          onClick={onReturnHome}
          title="Return to Home Page"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Code2 size={18} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '18px' }} className="gradient-text">
            NexForge
          </span>
        </div>

        <button
          onClick={onReturnHome}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '12px' }}
          title="Home Page"
        >
          <Home size={14} /> Home
        </button>

        {/* Workspace Dropdown */}
        <div ref={workspaceMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <span>{activeWorkspace ? activeWorkspace.name : 'Select Workspace'}</span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {showWorkspaceMenu && (
            <div className="glass-panel animate-fade-in" style={{
              position: 'absolute',
              top: '110%',
              left: 0,
              width: '220px',
              borderRadius: '8px',
              padding: '6px',
              zIndex: 200,
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Workspaces / Rooms
              </div>
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  onClick={() => {
                    selectWorkspace(ws);
                    setShowWorkspaceMenu(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: activeWorkspace?.id === ws.id ? 'var(--bg-active)' : 'transparent',
                    color: activeWorkspace?.id === ws.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{ws.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ws.language}</span>
                </div>
              ))}
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  onOpenNewWorkspace();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} />
                Create New Room
              </button>
            </div>
          )}
        </div>

        {/* Room ID Badge & Role */}
        {activeWorkspace && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontFamily: "'Fira Code', monospace",
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--accent-primary)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              Room: {activeWorkspace.id.slice(0, 8)}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}>
              Role: {userRole}
            </span>
          </div>
        )}
      </div>

      {/* Middle Controls (Run Code & Copy Link) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onRunCode}
          className="btn-primary"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '6px 16px',
            fontSize: '13px'
          }}
        >
          <Play size={15} />
          Run Code
        </button>

        <button
          onClick={handleCopyRoomLink}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '13px' }}
          title="Copy direct shareable room link to clipboard"
        >
          {copiedLink ? <Check size={15} color="#10b981" /> : <Link size={15} />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Room Link'}</span>
        </button>
      </div>

      {/* Right Controls: Presence, Video Call, Share, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Presence Avatars */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '-4px' }}>
          {presence.slice(0, 4).map((p, idx) => (
            <div
              key={p.userId + idx}
              title={`${p.userName} (${p.activeFilePath ? `Viewing ${p.activeFilePath}` : 'Idle'})`}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: `2px solid ${p.color}`,
                overflow: 'hidden',
                marginLeft: '-8px',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
            >
              {p.userAvatar ? (
                <img src={p.userAvatar} alt={p.userName} style={{ width: '100%', height: '100%' }} />
              ) : (
                p.userName.slice(0, 2).toUpperCase()
              )}
            </div>
          ))}
          {presence.length > 4 && (
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '-8px',
              border: '2px solid var(--bg-primary)'
            }}>
              +{presence.length - 4}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle variant="full" />

        {/* Invite Button */}
        <button
          onClick={onOpenShareModal}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '13px' }}
        >
          <UserPlus size={16} />
          Invite
        </button>

        {/* User Profile */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              background: showUserMenu ? 'var(--bg-hover)' : 'transparent'
            }}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px'
            }}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user?.name || 'User'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              ) : (
                (user?.name || 'User').slice(0, 2).toUpperCase()
              )}
            </div>
          </div>

          {showUserMenu && (
            <div className="glass-panel animate-fade-in" style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              width: '200px',
              borderRadius: '8px',
              padding: '12px',
              zIndex: 200,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{user?.name || 'Collaborator'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{user?.email || 'Logged In'}</div>
              <div style={{ height: '1px', background: 'var(--border-color)', marginBottom: '8px' }} />
              <button
                id="navbar-logout-btn"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--status-error)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  borderRadius: '4px'
                }}
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
