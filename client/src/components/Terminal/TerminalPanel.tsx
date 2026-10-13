import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getSocket } from '../../api/socket';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Terminal as TerminalIcon, Trash2, Clipboard, Box, Play, Lock, Users } from 'lucide-react';

interface TerminalPanelProps {
  height?: number;
  onClose?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ height = 220 }) => {
  const [activeTab, setActiveTab] = useState<'shared' | 'private'>('shared');

  const sharedContainerRef = useRef<HTMLDivElement>(null);
  const privateContainerRef = useRef<HTMLDivElement>(null);

  const sharedXtermRef = useRef<Terminal | null>(null);
  const privateXtermRef = useRef<Terminal | null>(null);

  const sharedFitAddonRef = useRef<FitAddon | null>(null);
  const privateFitAddonRef = useRef<FitAddon | null>(null);

  const { activeWorkspace, fetchFileTree } = useWorkspace();
  const { theme } = useTheme();
  const { user } = useAuth();
  const socket = getSocket();

  const isDark = theme === 'dark';

  const getTerminalTheme = (isPrivate = false) => ({
    background: isDark ? '#0a0d14' : '#ffffff',
    foreground: isDark ? '#f8fafc' : '#0f172a',
    cursor: isPrivate ? '#a855f7' : (isDark ? '#6366f1' : '#4f46e5'),
    selectionBackground: isPrivate ? 'rgba(168, 85, 247, 0.3)' : (isDark ? 'rgba(99, 102, 241, 0.3)' : '#e0e7ff'),
    black: isDark ? '#1e293b' : '#0f172a',
    red: '#f43f5e',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#ec4899',
    cyan: '#06b6d4',
    white: isDark ? '#f8fafc' : '#64748b'
  });

  const cleanTerminalPath = (text: string) => {
    if (!text || !activeWorkspace) return text;
    const wsName = (activeWorkspace.name || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFolder = `C:\\Users\\HP\\${wsName}`;
    return text
      .replace(/C:\\Users\\[^\\]+\\.gemini\\antigravity\\scratch\\nexforge\\workspaces_storage\\[a-f0-9-]+/gi, targetFolder)
      .replace(/C:[\\\/]Users[\\\/][^\\\/]+[\\\/]\.gemini[\\\/]antigravity[\\\/]scratch[\\\/]nexforge[\\\/]workspaces_storage[\\\/][a-f0-9-]+/gi, targetFolder)
      .replace(/C:[\\\/]Users[\\\/][^\\\/]+[\\\/]\.gemini[\\\/]antigravity[\\\/]scratch[\\\/]nexforge/gi, targetFolder)
      .replace(/\\\.gemini\\antigravity\\scratch\\nexforge/gi, `\\${wsName}`)
      .replace(/\.gemini[\\\/]antigravity[\\\/]scratch/gi, 'Projects')
      .replace(/\.gemini[\\\/]antigravity/gi, 'NexForgeDev');
  };

  // 1. Shared Terminal Lifecycle
  useEffect(() => {
    if (!sharedContainerRef.current || !activeWorkspace) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: getTerminalTheme(false),
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      rows: 10
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(sharedContainerRef.current);
    try { fitAddon.fit(); } catch (_) {}

    sharedXtermRef.current = term;
    sharedFitAddonRef.current = fitAddon;

    const currentWorkspaceId = activeWorkspace.id;
    const wsName = (activeWorkspace.name || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');

    const initSharedPty = () => {
      socket.emit('pty:init', { workspaceId: currentWorkspaceId, workspaceName: wsName });
    };

    initSharedPty();
    socket.on('connect', initSharedPty);

    const handleSharedPtyData = ({ data }: { data: string }) => {
      term.write(cleanTerminalPath(data));
    };

    socket.off('pty:data');
    socket.on('pty:data', handleSharedPtyData);

    term.onData((input) => {
      socket.emit('pty:input', { workspaceId: currentWorkspaceId, input });
      if (input.includes('\r') || input.includes('\n')) {
        setTimeout(() => {
          fetchFileTree();
        }, 1500);
      }
    });

    const containerEl = sharedContainerRef.current;
    const handleDomPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text');
      if (text) {
        socket.emit('pty:input', { workspaceId: currentWorkspaceId, input: text });
      }
    };
    containerEl.addEventListener('paste', handleDomPaste, true);

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'c' && term.hasSelection()) {
        return false;
      }
      if (event.ctrlKey && (event.key === 'v' || event.key === 'V')) {
        return false;
      }
      return true;
    });

    const handleResize = () => {
      try { fitAddon.fit(); } catch (_) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      socket.off('connect', initSharedPty);
      socket.off('pty:data', handleSharedPtyData);
      containerEl.removeEventListener('paste', handleDomPaste, true);
      window.removeEventListener('resize', handleResize);
      term.dispose();
      sharedXtermRef.current = null;
    };
  }, [activeWorkspace?.id, theme]);

  // 2. Private Terminal Lifecycle
  useEffect(() => {
    if (!privateContainerRef.current || !activeWorkspace) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: getTerminalTheme(true),
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      rows: 10
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(privateContainerRef.current);
    try { fitAddon.fit(); } catch (_) {}

    privateXtermRef.current = term;
    privateFitAddonRef.current = fitAddon;

    const currentWorkspaceId = activeWorkspace.id;
    const wsName = (activeWorkspace.name || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const userId = user?.id;

    const initPrivatePty = () => {
      socket.emit('pty:private:init', { workspaceId: currentWorkspaceId, workspaceName: wsName, userId });
    };

    initPrivatePty();
    socket.on('connect', initPrivatePty);

    const handlePrivatePtyData = ({ data }: { data: string }) => {
      term.write(cleanTerminalPath(data));
    };

    socket.off('pty:private:data');
    socket.on('pty:private:data', handlePrivatePtyData);

    term.onData((input) => {
      socket.emit('pty:private:input', { workspaceId: currentWorkspaceId, userId, input });
      if (input.includes('\r') || input.includes('\n')) {
        setTimeout(() => {
          fetchFileTree();
        }, 1500);
      }
    });

    const containerEl = privateContainerRef.current;
    const handleDomPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text');
      if (text) {
        socket.emit('pty:private:input', { workspaceId: currentWorkspaceId, userId, input: text });
      }
    };
    containerEl.addEventListener('paste', handleDomPaste, true);

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'c' && term.hasSelection()) {
        return false;
      }
      if (event.ctrlKey && (event.key === 'v' || event.key === 'V')) {
        return false;
      }
      return true;
    });

    const handleResize = () => {
      try { fitAddon.fit(); } catch (_) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      socket.off('connect', initPrivatePty);
      socket.off('pty:private:data', handlePrivatePtyData);
      containerEl.removeEventListener('paste', handleDomPaste, true);
      window.removeEventListener('resize', handleResize);
      term.dispose();
      privateXtermRef.current = null;
    };
  }, [activeWorkspace?.id, user?.id, theme]);

  // When switching tabs, re-fit active terminal
  const switchTab = (tab: 'shared' | 'private') => {
    setActiveTab(tab);
    setTimeout(() => {
      if (tab === 'shared') {
        try { sharedFitAddonRef.current?.fit(); } catch (_) {}
        sharedXtermRef.current?.focus();
      } else {
        try { privateFitAddonRef.current?.fit(); } catch (_) {}
        privateXtermRef.current?.focus();
      }
    }, 50);
  };

  const handleClear = () => {
    if (activeTab === 'shared') {
      sharedXtermRef.current?.clear();
      sharedXtermRef.current?.focus();
    } else {
      privateXtermRef.current?.clear();
      privateXtermRef.current?.focus();
    }
  };

  const handlePasteButton = async () => {
    if (!activeWorkspace) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (activeTab === 'shared') {
          socket.emit('pty:input', { workspaceId: activeWorkspace.id, input: text });
        } else {
          socket.emit('pty:private:input', { workspaceId: activeWorkspace.id, userId: user?.id, input: text });
        }
      }
    } catch (_) {
      const text = window.prompt('Paste command into terminal:');
      if (text) {
        if (activeTab === 'shared') {
          socket.emit('pty:input', { workspaceId: activeWorkspace.id, input: text });
        } else {
          socket.emit('pty:private:input', { workspaceId: activeWorkspace.id, userId: user?.id, input: text });
        }
      }
    }
    if (activeTab === 'shared') {
      sharedXtermRef.current?.focus();
    } else {
      privateXtermRef.current?.focus();
    }
  };

  const handleCreateVenvButton = () => {
    if (!activeWorkspace) return;
    if (activeTab === 'shared') {
      socket.emit('pty:input', { workspaceId: activeWorkspace.id, input: 'python -m venv venv\r\n' });
      sharedXtermRef.current?.focus();
    } else {
      socket.emit('pty:private:input', { workspaceId: activeWorkspace.id, userId: user?.id, input: 'python -m venv venv_private\r\n' });
      privateXtermRef.current?.focus();
    }
    setTimeout(() => {
      fetchFileTree();
    }, 4000);
  };

  const handlePipInstallButton = () => {
    if (!activeWorkspace) return;
    const isPrivate = activeTab === 'private';
    const pkg = window.prompt(
      isPrivate
        ? 'Enter Python library to install into PRIVATE isolated environment (venv_private):'
        : 'Enter Python library to install into SHARED environment (venv):',
      'pandas'
    );
    if (pkg && pkg.trim()) {
      const cmd = `pip install ${pkg.trim()}\r\n`;
      if (isPrivate) {
        socket.emit('pty:private:input', { workspaceId: activeWorkspace.id, userId: user?.id, input: cmd });
        privateXtermRef.current?.focus();
      } else {
        socket.emit('pty:input', { workspaceId: activeWorkspace.id, input: cmd });
        sharedXtermRef.current?.focus();
      }
    }
  };

  return (
    <div style={{
      height: `${height}px`,
      background: 'var(--bg-primary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Terminal Titlebar */}
      <div style={{
        padding: '4px 12px',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '36px'
      }}>
        {/* Left Side: Mode Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: '6px',
            padding: '2px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              onClick={() => switchTab('shared')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: activeTab === 'shared' ? 700 : 500,
                background: activeTab === 'shared' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'shared' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Shared collaborative terminal synced with teammates"
            >
              <Users size={12} />
              <span>Shared Terminal</span>
            </button>

            <button
              onClick={() => switchTab('private')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: activeTab === 'private' ? 700 : 500,
                background: activeTab === 'private' ? '#a855f7' : 'transparent',
                color: activeTab === 'private' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Private isolated terminal (only visible to you, installs into venv_private)"
            >
              <Lock size={12} />
              <span>Private Terminal</span>
            </button>
          </div>

          {/* Subtitle indicator */}
          <span style={{ fontSize: '11px', color: activeTab === 'private' ? '#c084fc' : 'var(--text-muted)', fontWeight: activeTab === 'private' ? 600 : 400 }}>
            {activeTab === 'private'
              ? '🔒 Isolated environment (venv_private) — not shared with peers'
              : '🌐 Collaborative workspace session'}
          </span>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Quick Create Venv Button */}
          <button
            onClick={handleCreateVenvButton}
            title={activeTab === 'private'
              ? "Create isolated private Virtual Environment (python -m venv venv_private)"
              : "Create shared Virtual Environment (python -m venv venv)"
            }
            style={{
              background: activeTab === 'private' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              border: activeTab === 'private' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              padding: '3px 8px',
              color: activeTab === 'private' ? '#c084fc' : '#10b981',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <Box size={12} />
            <span>{activeTab === 'private' ? 'Create Private Venv' : 'Create Venv'}</span>
          </button>

          {/* Quick Pip Install Button */}
          <button
            onClick={handlePipInstallButton}
            title={activeTab === 'private'
              ? "Install library isolated to venv_private without affecting peers"
              : "Install library into shared workspace venv"
            }
            style={{
              background: activeTab === 'private' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.1)',
              border: activeTab === 'private' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              padding: '3px 8px',
              color: activeTab === 'private' ? '#c084fc' : 'var(--accent-primary)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <Play size={11} />
            <span>{activeTab === 'private' ? 'pip install (Private)' : 'pip install'}</span>
          </button>

          {/* Quick Paste Button */}
          <button
            onClick={handlePasteButton}
            title="Paste Clipboard Command (Ctrl+V)"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '3px 8px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <Clipboard size={12} />
            <span>Paste</span>
          </button>

          {/* Clear Terminal Button */}
          <button
            onClick={handleClear}
            title="Clear Terminal (clear)"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Shared Terminal Container */}
      <div
        ref={sharedContainerRef}
        onClick={() => sharedXtermRef.current?.focus()}
        onContextMenu={async (e) => {
          e.preventDefault();
          await handlePasteButton();
        }}
        style={{
          flex: 1,
          padding: '8px',
          overflow: 'hidden',
          cursor: 'text',
          display: activeTab === 'shared' ? 'block' : 'none'
        }}
      />

      {/* Private Terminal Container */}
      <div
        ref={privateContainerRef}
        onClick={() => privateXtermRef.current?.focus()}
        onContextMenu={async (e) => {
          e.preventDefault();
          await handlePasteButton();
        }}
        style={{
          flex: 1,
          padding: '8px',
          overflow: 'hidden',
          cursor: 'text',
          display: activeTab === 'private' ? 'block' : 'none'
        }}
      />
    </div>
  );
};
