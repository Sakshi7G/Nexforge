import React, { useRef, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSocket } from '../../api/socket';
import { Sparkles, HelpCircle, Code, ShieldCheck, Lock, Unlock, Eye, X, Radio, AlertTriangle, Bug } from 'lucide-react';

interface FileLockInfo {
  socketId: string;
  userId: string;
  userName: string;
  filePath: string;
  lockedAt: string;
}

interface MonacoEditorWrapperProps {
  onTriggerAIAction: (type: 'explain' | 'refactor' | 'test' | 'review' | 'scan_bugs', selectedText?: string) => void;
}

export const MonacoEditorWrapper: React.FC<MonacoEditorWrapperProps> = ({ onTriggerAIAction }) => {
  const { user } = useAuth();
  const { activeFilePath, activeFileContent, updateFileContent, activeWorkspace } = useWorkspace();
  const { theme } = useTheme();

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const isLocalEditRef = useRef(false);

  const socket = getSocket();

  // Private Editing State
  const [fileLocks, setFileLocks] = React.useState<FileLockInfo[]>([]);
  const [isPrivateEdit, setIsPrivateEdit] = React.useState(false);
  const initialSharedContentRef = useRef<string>('');
  const privateDraftContentRef = useRef<string>('');
  const isLockedByMeRef = useRef(false);

  // Sync remote editor content updates into Monaco model smoothly & preserve remote cursor decorations
  useEffect(() => {
    if (editorRef.current && activeFileContent !== undefined) {
      // If currently editing privately, never let incoming remote sync overwrite local private draft!
      if (isLockedByMeRef.current) return;
      const editorValue = editorRef.current.getValue();
      if (editorValue !== activeFileContent) {
        isLocalEditRef.current = true;
        const pos = editorRef.current.getPosition();
        editorRef.current.setValue(activeFileContent);
        if (pos) editorRef.current.setPosition(pos);
        isLocalEditRef.current = false;
        // Re-apply cursor name badges immediately after model update
        renderAllRemoteCursors();
      }
    }
  }, [activeFileContent]);

  const getLanguage = (path: string | null) => {
    if (!path) return 'javascript';
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'cpp':
      case 'c':
      case 'h':
      case 'hpp':
        return 'cpp';
      case 'go':
        return 'go';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'javascript';
    }
  };

  const remoteCursorsMapRef = useRef<Map<string, { socketId: string; userId?: string; userName: string; color: string; filePath: string; cursor: any; selection?: any }>>(new Map());
  const allDecorationsRef = useRef<string[]>([]);

  const normalizePath = (p: string | null | undefined): string => {
    if (!p) return '';
    return p.replace(/\\/g, '/').replace(/^\/+/, '').trim().toLowerCase();
  };

  // Function to inject CSS rules for a peer's custom cursor line and name badge
  const injectPeerCursorStyle = (socketId: string, color: string, userName: string) => {
    const styleId = `remote-cursor-style-${socketId}`;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const escapedName = userName.replace(/"/g, '\\"');
    styleEl.innerHTML = `
      .remote-cursor-line-${socketId} {
        border-left: 2.5px solid ${color} !important;
        position: absolute !important;
        box-shadow: 0 0 12px ${color}99, 0 0 4px ${color} !important;
        z-index: 500 !important;
        transition: all 0.1s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
      }
      .remote-cursor-badge-${socketId} {
        position: relative !important;
        z-index: 1000 !important;
      }
      .remote-cursor-badge-${socketId}::after {
        content: "${escapedName}" !important;
        background: ${color} !important;
        color: #ffffff !important;
        font-size: 10.5px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-weight: 700 !important;
        padding: 2px 7px !important;
        border-radius: 5px 5px 5px 1px !important;
        position: absolute !important;
        top: -20px !important;
        left: 0px !important;
        pointer-events: none !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 8px ${color}66 !important;
        white-space: nowrap !important;
        z-index: 10000 !important;
        line-height: 1.2 !important;
        letter-spacing: 0.2px !important;
        transition: transform 0.1s ease-out !important;
      }
      .remote-cursor-badge-${socketId}::before {
        content: "" !important;
        position: absolute !important;
        top: -4px !important;
        left: 2px !important;
        border-width: 4px 4px 0 4px !important;
        border-style: solid !important;
        border-color: ${color} transparent transparent transparent !important;
        z-index: 10001 !important;
      }
      .remote-selection-${socketId} {
        background-color: ${color}28 !important;
        border-bottom: 1px solid ${color}66 !important;
      }
    `;
  };

  const renderAllRemoteCursors = () => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations: any[] = [];
    const activePathClean = normalizePath(activeFilePath);

    remoteCursorsMapRef.current.forEach((peer, peerKey) => {
      // Exclude self user by socket.id, user.id, or matching user.name!
      if ((peer.userId && peer.userId === user?.id) || peer.socketId === socket.id) return;
      if (peer.userName && user?.name && peer.userName.trim().toLowerCase() === user.name.trim().toLowerCase()) return;

      // Also check if this file is locked by this peer in private mode!
      const peerLock = fileLocks.find(l =>
        normalizePath(l.filePath) === activePathClean &&
        (l.socketId === peer.socketId || (peer.userId && l.userId === peer.userId) || (peer.userName && l.userName && l.userName.trim().toLowerCase() === peer.userName.trim().toLowerCase()))
      );
      if (peerLock) {
        // The peer is in private mode on this file, DO NOT render their cursor!
        return;
      }

      const peerPathClean = normalizePath(peer.filePath);
      if (peerPathClean === activePathClean && peer.cursor) {
        const cleanKey = peerKey.replace(/[^a-zA-Z0-9_-]/g, '');
        injectPeerCursorStyle(cleanKey, peer.color || '#3b82f6', peer.userName || 'Teammate');

        // Cursor line decoration with floating name badge
        newDecorations.push({
          range: new monaco.Range(peer.cursor.lineNumber, peer.cursor.column, peer.cursor.lineNumber, peer.cursor.column + 1),
          options: {
            className: `remote-cursor-line-${cleanKey}`,
            afterContentClassName: `remote-cursor-badge-${cleanKey}`,
            hoverMessage: { value: `**${peer.userName}** editing here` }
          }
        });

        // Selection highlight decoration if peer selected text
        if (peer.selection) {
          newDecorations.push({
            range: new monaco.Range(
              peer.selection.startLineNumber,
              peer.selection.startColumn,
              peer.selection.endLineNumber,
              peer.selection.endColumn
            ),
            options: {
              className: `remote-selection-${cleanKey}`
            }
          });
        }
      }
    });

    allDecorationsRef.current = editor.deltaDecorations(allDecorationsRef.current, newDecorations);
  };

  // Listen to active file locks broadcast from Socket.IO
  useEffect(() => {
    const handleLockStatus = (locks: FileLockInfo[]) => {
      setFileLocks(locks || []);
      const myLock = (locks || []).find(l =>
        normalizePath(l.filePath) === normalizePath(activeFilePath) &&
        (l.socketId === socket.id || (user?.id && l.userId === user.id))
      );
      if (!myLock && !isPrivateEdit) {
        isLockedByMeRef.current = false;
      }
      renderAllRemoteCursors();
    };
    socket.on('file:lock-status', handleLockStatus);
    return () => {
      socket.off('file:lock-status', handleLockStatus);
    };
  }, [socket, activeFilePath, user?.id, isPrivateEdit]);

  // Private Editing Actions
  const handleEnablePrivateEdit = () => {
    if (!activeWorkspace || !activeFilePath) return;
    const currentVal = editorRef.current ? editorRef.current.getValue() : (activeFileContent || '');
    initialSharedContentRef.current = currentVal;
    privateDraftContentRef.current = currentVal;
    setIsPrivateEdit(true);
    isLockedByMeRef.current = true;
    socket.emit('file:lock-private', {
      workspaceId: activeWorkspace.id,
      filePath: activeFilePath,
      userId: user?.id,
      userName: user?.name
    });
  };

  const handleShareChanges = async () => {
    if (!activeWorkspace || !activeFilePath) return;
    const currentVal = editorRef.current ? editorRef.current.getValue() : (privateDraftContentRef.current || activeFileContent || '');
    // 1. Emit publish-private to unlock on server and broadcast final content
    socket.emit('file:publish-private', {
      workspaceId: activeWorkspace.id,
      filePath: activeFilePath,
      content: currentVal
    });
    // 2. Persist to workspace disk via API
    setIsPrivateEdit(false);
    isLockedByMeRef.current = false;
    await updateFileContent(activeFilePath, currentVal);
  };

  const handleDiscardChanges = async () => {
    if (!activeWorkspace || !activeFilePath) return;
    const originalContent = initialSharedContentRef.current;
    if (editorRef.current) {
      isLocalEditRef.current = true;
      editorRef.current.setValue(originalContent);
      isLocalEditRef.current = false;
    }
    socket.emit('file:unlock-private', {
      workspaceId: activeWorkspace.id,
      filePath: activeFilePath,
      userId: user?.id
    });
    setIsPrivateEdit(false);
    isLockedByMeRef.current = false;
    await updateFileContent(activeFilePath, originalContent);
  };

  // Re-render cursors when activeFilePath changes
  useEffect(() => {
    renderAllRemoteCursors();
  }, [activeFilePath]);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    socket.on('editor:cursor-move', ({ socketId, userId, userName, color, filePath, cursor, selection }) => {
      // Ignore cursor moves belonging to the current local user (by ID or by name)
      if (socketId === socket.id) return;
      if (userId && user?.id && userId === user.id) return;
      if (userName && user?.name && userName.trim().toLowerCase() === user.name.trim().toLowerCase()) return;

      if (cursor) {
        const peerKey = (userId || socketId).replace(/[^a-zA-Z0-9_-]/g, '');
        remoteCursorsMapRef.current.set(peerKey, {
          socketId,
          userId,
          userName: userName || 'Teammate',
          color: color || '#3b82f6',
          filePath,
          cursor,
          selection
        });
        renderAllRemoteCursors();
      }
    });

    socket.on('presence:update', (presenceUsers: any[]) => {
      if (Array.isArray(presenceUsers)) {
        const activeUserIds = new Set(presenceUsers.map(u => u.userId).filter(Boolean));
        remoteCursorsMapRef.current.forEach((peer, peerKey) => {
          if (peer.userId && !activeUserIds.has(peer.userId)) {
            remoteCursorsMapRef.current.delete(peerKey);
          }
        });
        renderAllRemoteCursors();
      }
    });

    socket.on('editor:content-change', () => {
      renderAllRemoteCursors();
    });

    const handleCursorOrSelectionChange = () => {
      // In private edit mode, do NOT broadcast cursor or selection to peers!
      if (isLockedByMeRef.current) return;

      if (activeWorkspace && activeFilePath && editorRef.current) {
        const cursor = editorRef.current.getPosition();
        const selection = editorRef.current.getSelection();
        if (cursor) {
          socket.emit('editor:cursor-move', {
            workspaceId: activeWorkspace.id,
            filePath: activeFilePath,
            userId: user?.id,
            userName: user?.name || 'Teammate',
            cursor: { lineNumber: cursor.lineNumber, column: cursor.column },
            selection
          });
        }
      }
    };

    editor.onDidChangeCursorPosition(handleCursorOrSelectionChange);
    editor.onDidChangeCursorSelection(handleCursorOrSelectionChange);
    editor.onDidChangeModelContent(() => {
      handleCursorOrSelectionChange();
      renderAllRemoteCursors();
    });

    renderAllRemoteCursors();
  };

  const handleEditorChange = (value: string | undefined) => {
    if (isLocalEditRef.current) return;
    if (value !== undefined && activeFilePath) {
      if (isLockedByMeRef.current) {
        // In private mode: buffer edits locally, DO NOT save to disk via API and DO NOT emit socket changes to peers
        privateDraftContentRef.current = value;
        return;
      }
      updateFileContent(activeFilePath, value);
    }
  };

  const handleSelectedTextAction = (type: 'explain' | 'refactor' | 'test' | 'review') => {
    let selectedText = '';
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection) {
        selectedText = editorRef.current.getModel().getValueInRange(selection);
      }
    }
    onTriggerAIAction(type, selectedText);
  };

  const activeLock = fileLocks.find(l => normalizePath(l.filePath) === normalizePath(activeFilePath));
  const isLockedByPeer = Boolean(activeLock && activeLock.socketId !== socket.id && (!user?.id || activeLock.userId !== user.id));
  const isLockedByMe = Boolean(
    (activeLock && (activeLock.socketId === socket.id || (user?.id && activeLock.userId === user.id))) ||
    isPrivateEdit
  );
  isLockedByMeRef.current = isLockedByMe;

  if (!activeFilePath) {
    return (
      <div style={{
        flex: 1,
        height: '100%',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'var(--bg-secondary)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <Sparkles size={32} color="var(--accent-primary)" />
        </div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 600 }}>
          NexForge Editor Ready
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Select or create a file from the explorer to begin real-time editing & AI assistance.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Top Editing Mode Header Bar */}
      <div style={{
        padding: '6px 16px',
        background: isLockedByPeer
          ? 'rgba(239, 68, 68, 0.12)'
          : isLockedByMe
          ? 'rgba(168, 85, 247, 0.12)'
          : 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 25,
        userSelect: 'none'
      }}>
        {/* Left Mode Indicator Badge */}
        {isLockedByPeer ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '12px', fontWeight: '700' }}>
            <Lock size={14} />
            <span>Locked by {activeLock?.userName || 'Collaborator'} (Private Edit Mode)</span>
          </div>
        ) : isLockedByMe ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontSize: '12px', fontWeight: '700' }}>
            <Lock size={14} />
            <span>Private Edit Mode (Only visible to you)</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px', fontWeight: '600' }}>
            <Radio size={14} className="animate-pulse" />
            <span>Shared Editing (Live Real-Time Sync)</span>
          </div>
        )}

        {/* Right Mode Toggle & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLockedByPeer ? (
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              File is read-only until {activeLock?.userName} finishes
            </span>
          ) : isLockedByMe ? (
            <>
              <button
                onClick={handleShareChanges}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
                title="Publish latest changes to all room collaborators"
              >
                <Eye size={13} /> Share Changes
              </button>

              <button
                onClick={handleDiscardChanges}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                title="Revert to last shared version and unlock"
              >
                <X size={13} /> Discard Changes
              </button>
            </>
          ) : (
            <button
              onClick={handleEnablePrivateEdit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Lock file and edit privately without broadcasting typing"
            >
              <Lock size={12} style={{ color: '#a855f7' }} /> Enable Private Edit
            </button>
          )}
        </div>
      </div>

      {/* AI Quick Floating Action Toolbar */}
      <div style={{
        position: 'absolute',
        top: '44px',
        right: '24px',
        zIndex: 20,
        display: 'flex',
        gap: '6px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '4px 8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
      }}>
        <button
          onClick={() => handleSelectedTextAction('explain')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          title="Explain selected code with Gemini AI"
        >
          <HelpCircle size={13} color="var(--accent-secondary)" />
          Explain
        </button>
        <button
          onClick={() => handleSelectedTextAction('refactor')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          title="Refactor selected code"
        >
          <Code size={13} color="var(--accent-primary)" />
          Refactor
        </button>
        <button
          onClick={() => handleSelectedTextAction('test')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          title="Generate unit tests"
        >
          <Sparkles size={13} color="#db2777" />
          Gen Tests
        </button>
        <button
          onClick={() => handleSelectedTextAction('review')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          title="Perform AI code review"
        >
          <ShieldCheck size={13} color="var(--status-success)" />
          Review File
        </button>
        <button
          onClick={() => onTriggerAIAction('scan_bugs')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#fda4af' }}
          title="Scan active file for bugs and vulnerabilities with Gemini AI"
        >
          <Bug size={13} color="#f43f5e" />
          Scan Bugs
        </button>
      </div>

      {/* Monaco Editor Component supporting dynamic Theme */}
      <Editor
        height="100%"
        path={activeFilePath}
        language={getLanguage(activeFilePath)}
        value={activeFileContent}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        options={{
          readOnly: isLockedByPeer,
          fontSize: 14,
          fontFamily: "'Fira Code', monospace",
          minimap: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          automaticLayout: true
        }}
      />
    </div>
  );
};
