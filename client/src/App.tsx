import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ThemeProvider } from './context/ThemeContext';

import { LandingPage } from './components/Landing/LandingPage';
import { SessionSetupPage } from './components/Session/SessionSetupPage';
import { AuthModal } from './components/Auth/AuthModal';
import { TopNavbar } from './components/Header/TopNavbar';
import { ShareModal } from './components/Header/ShareModal';
import { NewWorkspaceModal } from './components/Header/NewWorkspaceModal';
import { SidebarNavigation, ActiveSidePanel } from './components/Layout/SidebarNavigation';
import { FileTree } from './components/FileExplorer/FileTree';
import { NewItemModal } from './components/FileExplorer/NewItemModal';
import { FileTabs } from './components/Editor/FileTabs';
import { MonacoEditorWrapper } from './components/Editor/MonacoEditorWrapper';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { ExecutionConsole } from './components/Terminal/ExecutionConsole';
import { AIChatPanel } from './components/AI/AIChatPanel';
import { AIDebuggerModal } from './components/AI/AIDebuggerModal';
import { AIExplainModal } from './components/AI/AIExplainModal';
import { AIRefactorModal } from './components/AI/AIRefactorModal';
import { AIGenTestsModal } from './components/AI/AIGenTestsModal';
import { AIReviewModal } from './components/AI/AIReviewModal';
import { WhiteboardCanvas } from './components/Whiteboard/WhiteboardCanvas';
import { VideoCallOverlay } from './components/Video/VideoCallOverlay';
import { GoogleMeetPanel } from './components/Video/GoogleMeetPanel';
import { ChatPanel } from './components/TeamChat/ChatPanel';
import { GitPanel } from './components/Git/GitPanel';
import { NotesPanel } from './components/Notes/NotesPanel';
import { DataSheetsPanel } from './components/Sheets/DataSheetsPanel';
import api from './api/client';
import { getSocket } from './api/socket';

const MainIDEContent: React.FC<{ onReturnHome: () => void }> = ({ onReturnHome }) => {
  const { user } = useAuth();
  const { activeWorkspace, activeFilePath, selectWorkspace, workspaces } = useWorkspace();

  const [activeSidePanel, setActiveSidePanel] = useState<ActiveSidePanel>('files');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemParentPath, setNewItemParentPath] = useState<string>('');
  const [newItemIsFolder, setNewItemIsFolder] = useState<boolean>(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);

  // Resizable Panels State (VS Code Splitters)
  const [rightDrawerWidth, setRightDrawerWidth] = useState(360);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(240);
  const isResizingRightRef = useRef(false);
  const isResizingBottomRef = useRef(false);

  // Code execution state
  const [showExecutionConsole, setShowExecutionConsole] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStdout, setExecutionStdout] = useState('');
  const [executionStderr, setExecutionStderr] = useState('');
  const [executionExitCode, setExecutionExitCode] = useState<number | null>(null);

  // AI Trigger states
  const [aiPromptType, setAiPromptType] = useState<string | undefined>(undefined);
  const [aiSelectedCode, setAiSelectedCode] = useState<string | undefined>(undefined);
  const [debuggerErrorLog, setDebuggerErrorLog] = useState<string | null>(null);
  const [explainSelectedCode, setExplainSelectedCode] = useState<string | null>(null);
  const [refactorSelectedCode, setRefactorSelectedCode] = useState<string | null>(null);
  const [genTestsSelectedCode, setGenTestsSelectedCode] = useState<string | null>(null);
  const [reviewSelectedCode, setReviewSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdParam = urlParams.get('room');
    if (roomIdParam && workspaces.length > 0) {
      const targetWs = workspaces.find(w => w.id === roomIdParam);
      if (targetWs) {
        selectWorkspace(targetWs);
      }
    }
  }, [workspaces]);

  // Global mouse move handlers for panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRightRef.current) {
        const newWidth = window.innerWidth - e.clientX;
        setRightDrawerWidth(Math.max(260, Math.min(800, newWidth)));
      }
      if (isResizingBottomRef.current) {
        const newHeight = window.innerHeight - e.clientY;
        setBottomPanelHeight(Math.max(120, Math.min(650, newHeight)));
      }
    };

    const handleMouseUp = () => {
      isResizingRightRef.current = false;
      isResizingBottomRef.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Remote code execution listener across peers in room
  useEffect(() => {
    if (!activeWorkspace) return;
    const socket = getSocket();

    const handleRemoteExecution = ({ stdout, stderr, exitCode }: any) => {
      setExecutionStdout(stdout || '');
      setExecutionStderr(stderr || '');
      setExecutionExitCode(exitCode ?? 0);
      setShowExecutionConsole(true);
      setIsExecuting(false);
    };

    socket.on('code:executed', handleRemoteExecution);
    return () => {
      socket.off('code:executed', handleRemoteExecution);
    };
  }, [activeWorkspace]);

  const handleRunCode = async () => {
    if (!activeWorkspace || !activeFilePath) {
      alert('Please open a file to execute code!');
      return;
    }
    setShowExecutionConsole(true);
    setIsExecuting(true);
    setExecutionStdout('');
    setExecutionStderr('');
    setExecutionExitCode(null);

    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/execute`, {
        entryFile: activeFilePath,
        language: activeWorkspace.language
      });

      const stdout = res.data.stdout || '';
      const stderr = res.data.stderr || '';
      const exitCode = res.data.exitCode ?? 0;

      setExecutionStdout(stdout);
      setExecutionStderr(stderr);
      setExecutionExitCode(exitCode);

      // Broadcast execution output to all peers in the room
      const socket = getSocket();
      socket.emit('code:executed', {
        workspaceId: activeWorkspace.id,
        stdout,
        stderr,
        exitCode,
        language: activeWorkspace.language,
        filePath: activeFilePath,
        runnerName: user?.name || 'Teammate'
      });
    } catch (err: any) {
      const stderr = err.response?.data?.error || err.message;
      setExecutionStderr(stderr);
      setExecutionExitCode(1);

      const socket = getSocket();
      socket.emit('code:executed', {
        workspaceId: activeWorkspace.id,
        stdout: '',
        stderr,
        exitCode: 1,
        language: activeWorkspace.language,
        filePath: activeFilePath,
        runnerName: user?.name || 'Teammate'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTriggerAIAction = (type: 'explain' | 'refactor' | 'test' | 'review' | 'scan_bugs', selectedText?: string) => {
    if (type === 'scan_bugs') {
      setDebuggerErrorLog('');
      return;
    }
    if (type === 'explain') {
      setExplainSelectedCode(selectedText || '');
      return;
    }
    if (type === 'refactor') {
      setRefactorSelectedCode(selectedText || '');
      return;
    }
    if (type === 'test') {
      setGenTestsSelectedCode(selectedText || '');
      return;
    }
    if (type === 'review') {
      setReviewSelectedCode(selectedText || '');
      return;
    }
    setAiPromptType(type);
    setAiSelectedCode(selectedText);
    setActiveSidePanel('ai');
  };

  const handleOpenAutoFix = (stderr: string) => {
    setDebuggerErrorLog(stderr);
  };

  const handleOpenNewItem = (parentPath?: string, defaultIsFolder?: boolean) => {
    setNewItemParentPath(parentPath || '');
    setNewItemIsFolder(defaultIsFolder ?? false);
    setShowNewItemModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <TopNavbar
        onOpenNewWorkspace={() => setShowNewWorkspaceModal(true)}
        onOpenShareModal={() => setShowShareModal(true)}
        onRunCode={handleRunCode}
        onToggleVideoCall={() => setIsVideoCallActive(!isVideoCallActive)}
        onReturnHome={onReturnHome}
        isVideoCallActive={isVideoCallActive}
        activeVideoCount={isVideoCallActive ? 1 : 0}
      />

      {/* Main Studio Body */}
      <div style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Vertical Icon Navigation */}
        <SidebarNavigation
          activePanel={activeSidePanel}
          onSelectPanel={panel => setActiveSidePanel(panel)}
        />

        {/* File Explorer Tree */}
        {activeSidePanel === 'files' && (
          <FileTree onOpenNewItemModal={handleOpenNewItem} />
        )}

        {/* Center Main Stage (Editor, Whiteboard, Video Call, or Notes) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
          {activeSidePanel === 'whiteboard' ? (
            <WhiteboardCanvas />
          ) : activeSidePanel === 'video' ? (
            <GoogleMeetPanel onLeave={() => setActiveSidePanel('files')} />
          ) : activeSidePanel === 'notes' ? (
            <NotesPanel />
          ) : activeSidePanel === 'sheets' ? (
            <DataSheetsPanel />
          ) : (
            <>
              <FileTabs />
              <MonacoEditorWrapper onTriggerAIAction={handleTriggerAIAction} />

              {/* Horizontal Resizer Line for Bottom Panel */}
              <div
                onMouseDown={() => {
                  isResizingBottomRef.current = true;
                  document.body.style.cursor = 'row-resize';
                }}
                style={{
                  height: '4px',
                  background: 'var(--border-color)',
                  cursor: 'row-resize',
                  zIndex: 40,
                  transition: 'background 0.2s'
                }}
                className="hover-bg-active"
                title="Drag to resize terminal / console height"
              />

              {/* Bottom Console / Terminal Panels (Persistent Terminal Session) */}
              <div style={{
                height: `${bottomPanelHeight}px`,
                display: showExecutionConsole ? 'block' : 'none',
                width: '100%',
                overflow: 'hidden'
              }}>
                <ExecutionConsole
                  stdout={executionStdout}
                  stderr={executionStderr}
                  exitCode={executionExitCode}
                  isRunning={isExecuting}
                  onAutoFixError={handleOpenAutoFix}
                  onClose={() => setShowExecutionConsole(false)}
                />
              </div>

              <div style={{
                height: `${bottomPanelHeight}px`,
                display: showExecutionConsole ? 'none' : 'flex',
                flexDirection: 'column',
                width: '100%',
                overflow: 'hidden'
              }}>
                <TerminalPanel height={bottomPanelHeight} isVisible={!showExecutionConsole} />
              </div>
            </>
          )}
        </div>

        {/* Vertical Resizer Line for Right Drawer */}
        {(activeSidePanel === 'ai' || activeSidePanel === 'chat' || activeSidePanel === 'git') && (
          <div
            onMouseDown={() => {
              isResizingRightRef.current = true;
              document.body.style.cursor = 'col-resize';
            }}
            style={{
              width: '4px',
              height: '100%',
              background: 'var(--border-color)',
              cursor: 'col-resize',
              zIndex: 40,
              transition: 'background 0.2s'
            }}
            className="hover-bg-active"
            title="Drag to resize panel width"
          />
        )}

        {/* Right Side Drawer (AI, Chat, Git) */}
        {activeSidePanel === 'ai' && (
          <AIChatPanel
            width={rightDrawerWidth}
            initialPromptType={aiPromptType}
            initialSelectedCode={aiSelectedCode}
          />
        )}

        {activeSidePanel === 'chat' && <ChatPanel width={rightDrawerWidth} />}

        {activeSidePanel === 'git' && <GitPanel width={rightDrawerWidth} />}
      </div>

      {/* Modals & Overlays */}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}

      {showNewWorkspaceModal && <NewWorkspaceModal onClose={() => setShowNewWorkspaceModal(false)} />}

      {showNewItemModal && (
        <NewItemModal
          onClose={() => setShowNewItemModal(false)}
          defaultParentPath={newItemParentPath}
          defaultIsFolder={newItemIsFolder}
        />
      )}

      {debuggerErrorLog !== null && (
        <AIDebuggerModal
          errorLog={debuggerErrorLog}
          onClose={() => setDebuggerErrorLog(null)}
        />
      )}

      {explainSelectedCode !== null && (
        <AIExplainModal
          selectedCode={explainSelectedCode}
          onClose={() => setExplainSelectedCode(null)}
        />
      )}

      {refactorSelectedCode !== null && (
        <AIRefactorModal
          selectedCode={refactorSelectedCode}
          onClose={() => setRefactorSelectedCode(null)}
        />
      )}

      {genTestsSelectedCode !== null && (
        <AIGenTestsModal
          selectedCode={genTestsSelectedCode}
          onClose={() => setGenTestsSelectedCode(null)}
        />
      )}

      {reviewSelectedCode !== null && (
        <AIReviewModal
          selectedCode={reviewSelectedCode}
          onClose={() => setReviewSelectedCode(null)}
        />
      )}

      {isVideoCallActive && (
        <VideoCallOverlay onClose={() => setIsVideoCallActive(false)} />
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();
  const { workspaces, createWorkspace, joinWorkspace, selectWorkspace } = useWorkspace();
  const [view, setView] = useState<'landing' | 'setup' | 'ide'>('landing');
  const [initialRoomId, setInitialRoomId] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingJoinDetails, setPendingJoinDetails] = useState<{ name: string; email: string; roomNameOrId: string; role: string } | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
      setInitialRoomId(roomId);
      setView('setup');
    }
  }, []);

  // Auto-redirect to landing page when user logs out while in IDE or setup
  useEffect(() => {
    if (!user && view === 'ide') {
      setView('landing');
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [user, view]);

  const handleStartSessionFromLanding = () => {
    setView('setup');
  };

  const handleJoinSessionFromSetup = async (displayName: string, email: string, roomNameOrId: string, role: string) => {
    if (!user) {
      setPendingJoinDetails({ name: displayName, email, roomNameOrId, role });
      setShowAuthModal(true);
      return;
    }

    if (roomNameOrId) {
      const found = workspaces.find(w => w.id === roomNameOrId || w.name.toLowerCase() === roomNameOrId.toLowerCase());
      if (found) {
        selectWorkspace(found);
      } else {
        try {
          await joinWorkspace(roomNameOrId);
        } catch {
          await createWorkspace(roomNameOrId, `Session room created by ${displayName}`, 'typescript');
        }
      }
    } else if (workspaces.length === 0) {
      await createWorkspace('my-first-room', 'Default collaborative room', 'typescript');
    }

    setView('ide');
  };

  // Auto-resume session join after login / signup completes
  useEffect(() => {
    if (user && pendingJoinDetails) {
      const details = pendingJoinDetails;
      setPendingJoinDetails(null);
      setShowAuthModal(false);
      handleJoinSessionFromSetup(details.name, details.email, details.roomNameOrId, details.role);
    }
  }, [user, pendingJoinDetails]);

  return (
    <>
      {view === 'landing' && (
        <LandingPage
          onStartSession={handleStartSessionFromLanding}
          onOpenAuth={() => setShowAuthModal(true)}
          user={user}
          onLogout={logout}
        />
      )}

      {view === 'setup' && (
        <SessionSetupPage
          initialRoomId={initialRoomId}
          onJoinSession={handleJoinSessionFromSetup}
          onReturnHome={() => setView('landing')}
        />
      )}

      {view === 'ide' && (
        <MainIDEContent onReturnHome={() => setView('landing')} />
      )}

      {showAuthModal && !user && (
        <AuthModal
          initialIsLogin={false}
          initialName={pendingJoinDetails?.name || ''}
          initialEmail={pendingJoinDetails?.email || ''}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <AppContent />
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
