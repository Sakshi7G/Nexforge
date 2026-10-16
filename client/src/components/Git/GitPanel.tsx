import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import {
  GitBranch, GitCommit, Sparkles, Plus, Minus, RefreshCw,
  UploadCloud, DownloadCloud, Link, FileCode, History, Check,
  AlertCircle, Loader2, GitPullRequest, FolderPlus
} from 'lucide-react';
import { GitDiffModal } from './GitDiffModal';

interface GitPanelProps {
  width?: number;
}

interface GitFileStatus {
  path: string;
  index: string;
  working_dir: string;
}

export const GitPanel: React.FC<GitPanelProps> = ({ width = 360 }) => {
  const { activeWorkspace, fetchFileTree } = useWorkspace();
  const [isRepo, setIsRepo] = useState(false);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<GitFileStatus[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitFileStatus[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'push' | 'pull' | 'stage' | 'commit' | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Modals state
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [inputRemoteUrl, setInputRemoteUrl] = useState('');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [diffFilePath, setDiffFilePath] = useState<string | null>(null);

  // Fetch full status
  const fetchStatus = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const res = await api.get(`/workspaces/${activeWorkspace.id}/git/status`);
      const statusData = res.data.status || {};
      setIsRepo(statusData.isRepo || false);
      setCurrentBranch(statusData.currentBranch || 'main');
      setRemoteUrl(statusData.remoteUrl || null);

      const allFiles: GitFileStatus[] = statusData.files || [];
      const staged = allFiles.filter(f => f.index && f.index !== '?' && f.index !== ' ');
      const unstaged = allFiles.filter(f => f.working_dir && f.working_dir !== ' ');

      setStagedFiles(staged);
      setUnstagedFiles(unstaged);
    } catch (err) {
      console.error('Failed to fetch git status:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  // Fetch branches list
  const fetchBranches = useCallback(async () => {
    if (!activeWorkspace || !isRepo) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspace.id}/git/branches`);
      const bInfo = res.data.branchInfo || {};
      setCurrentBranch(bInfo.current || 'main');
      setBranches(bInfo.branches || ['main']);
    } catch (err) {
      console.error(err);
    }
  }, [activeWorkspace, isRepo]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (isRepo) fetchBranches();
  }, [isRepo, fetchBranches]);

  // Actions
  const handleInitRepo = async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      await api.post(`/workspaces/${activeWorkspace.id}/git/init`);
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStage = async (filePath?: string) => {
    if (!activeWorkspace) return;
    try {
      setActionLoading('stage');
      await api.post(`/workspaces/${activeWorkspace.id}/git/stage`, { filePath });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnstage = async (filePath?: string) => {
    if (!activeWorkspace) return;
    try {
      setActionLoading('stage');
      await api.post(`/workspaces/${activeWorkspace.id}/git/unstage`, { filePath });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateAICommitMsg = async () => {
    if (!activeWorkspace) return;
    setGeneratingAi(true);
    try {
      const diffRes = await api.get(`/workspaces/${activeWorkspace.id}/git/diff`);
      const gitDiff = diffRes.data.diff;

      const aiRes = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType: 'commit',
        userPrompt: 'Generate a single-line semantic commit message for the git changes',
        gitDiff: gitDiff || 'Staged workspace changes'
      });

      if (aiRes.data.response) {
        const cleanMsg = aiRes.data.response
          .trim()
          .replace(/```(?:\w+)?/g, '')
          .replace(/```/g, '')
          .replace(/^["'`]|["'`]$/g, '')
          .trim();
        setCommitMsg(cleanMsg);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim() || !activeWorkspace) return;
    setActionLoading('commit');
    try {
      await api.post(`/workspaces/${activeWorkspace.id}/git/commit`, { message: commitMsg });
      setCommitMsg('');
      await fetchStatus();
      alert('Changes committed successfully!');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Error committing changes';
      alert(`Commit failed: ${errMsg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveRemote = async () => {
    if (!activeWorkspace || !inputRemoteUrl.trim()) return;
    const cleanUrl = inputRemoteUrl.trim();
    try {
      setLoading(true);
      const res = await api.post(`/workspaces/${activeWorkspace.id}/git/remote`, { url: cleanUrl });
      setRemoteUrl(res.data.remoteUrl);
      setShowRemoteModal(false);
      setInputRemoteUrl('');
      await fetchStatus();
      alert('Remote repository connected successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to set remote: ${err.response?.data?.details || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async (force = false) => {
    if (!activeWorkspace) return;
    setActionLoading('push');
    try {
      await api.post(`/workspaces/${activeWorkspace.id}/git/push`, { branch: currentBranch, force });
      await fetchStatus();
      alert(`Pushed changes successfully to origin/${currentBranch}!`);
    } catch (err: any) {
      const errMsg = err.response?.data?.details || err.message || '';
      if (!force && (errMsg.includes('non-fast-forward') || errMsg.includes('behind') || errMsg.includes('rejected'))) {
        const userChoice = window.confirm(
          `Your local branch is behind the remote GitHub repository.\n\n` +
          `Would you like to Force Push and overwrite GitHub with your local workspace code?\n\n` +
          `• Click OK to Force Push\n` +
          `• Click Cancel to Pull remote changes first`
        );
        if (userChoice) {
          await handlePush(true);
          return;
        }
      }
      alert(`Push failed: ${errMsg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePull = async (force = false) => {
    if (!activeWorkspace) return;
    setActionLoading('pull');
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/git/pull`, { branch: currentBranch, force });
      await fetchStatus();
      if (fetchFileTree) await fetchFileTree();
      alert(res.data.message || `Pulled latest changes from origin/${currentBranch}!`);
    } catch (err: any) {
      const errMsg = err.response?.data?.details || err.message || '';
      if (!force && (
        errMsg.toLowerCase().includes('conflict') ||
        errMsg.toLowerCase().includes('overwritten') ||
        errMsg.toLowerCase().includes('aborting') ||
        errMsg.toLowerCase().includes('unrelated histories')
      )) {
        const userChoice = window.confirm(
          `Conflict Detected while Pulling:\n\n${errMsg}\n\n` +
          `Would you like to Force Pull and overwrite local workspace files with the code from GitHub?\n\n` +
          `• Click OK to Force Pull (overwrite local workspace with GitHub)\n` +
          `• Click Cancel to keep your local changes`
        );
        if (userChoice) {
          await handlePull(true);
          return;
        }
      }
      alert(`Pull failed: ${errMsg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckoutBranch = async (bName: string, isNew = false) => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      await api.post(`/workspaces/${activeWorkspace.id}/git/checkout`, { branchName: bName, createNew: isNew });
      setShowBranchModal(false);
      setNewBranchName('');
      await fetchStatus();
      await fetchBranches();
    } catch (err: any) {
      alert(err.response?.data?.details || 'Failed to switch branch');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspace.id}/git/log`);
      setHistory(res.data.history || []);
      setShowHistory(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{
      width: `${width}px`,
      height: '100%',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-tertiary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={18} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>Source Control</span>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={fetchStatus}
            title="Refresh Status"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={fetchHistory}
            title="View Commit Log"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <History size={14} />
          </button>
        </div>
      </div>

      {!isRepo ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <GitBranch size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No Git Repository</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
            Initialize Git in this workspace to track changes, create branches, and push to GitHub.
          </p>
          <button
            onClick={handleInitRepo}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            Initialize Git Repository
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          
          {/* Branch & GitHub Remote Sync Bar */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* Branch Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-secondary)' }}>
                <GitBranch size={14} />
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{currentBranch}</span>
              </div>

              <button
                onClick={() => setShowBranchModal(true)}
                style={{ fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '600' }}
              >
                + New Branch
              </button>
            </div>

            {/* Remote URL & Push / Pull */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
              <button
                onClick={() => {
                  setInputRemoteUrl(remoteUrl || '');
                  setShowRemoteModal(true);
                }}
                style={{ fontSize: '11px', background: 'transparent', border: 'none', color: remoteUrl ? 'var(--status-success)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                title={remoteUrl || 'Click to connect GitHub repository'}
              >
                <Link size={12} /> {remoteUrl ? 'GitHub Connected' : 'Connect Remote'}
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handlePull(false)}
                  disabled={actionLoading === 'pull' || !remoteUrl}
                  title="Pull latest changes from GitHub"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: remoteUrl ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: remoteUrl ? 1 : 0.5
                  }}
                >
                  {actionLoading === 'pull' ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />} Pull
                </button>

                <button
                  onClick={() => handlePush(false)}
                  disabled={actionLoading === 'push' || !remoteUrl}
                  title="Push commits to GitHub origin"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: remoteUrl ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: remoteUrl ? 1 : 0.5
                  }}
                >
                  {actionLoading === 'push' ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Push
                </button>
              </div>
            </div>
          </div>

          {/* Commit Message Box */}
          <form onSubmit={handleCommit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Commit Message
              </label>
              <button
                type="button"
                onClick={handleGenerateAICommitMsg}
                disabled={generatingAi}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '600'
                }}
              >
                <Sparkles size={12} />
                {generatingAi ? 'Generating...' : 'AI Message'}
              </button>
            </div>

            <textarea
              rows={3}
              placeholder="feat(core): implement real-time git collaboration..."
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'none'
              }}
            />

            <button
              type="submit"
              disabled={actionLoading === 'commit' || !commitMsg.trim()}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '12px',
                cursor: commitMsg.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: commitMsg.trim() ? 1 : 0.5
              }}
            >
              {actionLoading === 'commit' ? <Loader2 size={14} className="animate-spin" /> : <GitCommit size={14} />}
              Commit Changes
            </button>
          </form>

          {/* Staged Changes Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Staged Changes ({stagedFiles.length})
              </span>
              {stagedFiles.length > 0 && (
                <button
                  onClick={() => handleUnstage()}
                  title="Unstage All"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                >
                  Unstage All
                </button>
              )}
            </div>

            {stagedFiles.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>No staged changes</div>
            ) : (
              stagedFiles.map((f, i) => (
                <div
                  key={i}
                  onClick={() => setDiffFilePath(f.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-primary)',
                    marginBottom: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileCode size={13} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.path}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>{f.index}</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleUnstage(f.path); }}
                      title="Unstage file"
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Unstaged Changes Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Changes ({unstagedFiles.length})
              </span>
              {unstagedFiles.length > 0 && (
                <button
                  onClick={() => handleStage()}
                  title="Stage All"
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Stage All
                </button>
              )}
            </div>

            {unstagedFiles.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>Working directory clean</div>
            ) : (
              unstagedFiles.map((f, i) => (
                <div
                  key={i}
                  onClick={() => setDiffFilePath(f.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-primary)',
                    marginBottom: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileCode size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.path}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: f.working_dir === '?' ? '#10b981' : '#f59e0b' }}>
                      {f.working_dir === '?' ? 'U' : f.working_dir}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleStage(f.path); }}
                      title="Stage file"
                      style={{ border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer' }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* GitHub Remote Config Modal */}
      {showRemoteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '460px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>Connect Remote Repository</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Configure your remote origin URL for pushing and pulling code.</p>
            
            <div style={{ marginBottom: '14px', background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <div style={{ fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '4px' }}>💡 Remote URL Formats:</div>
              <div>• <b>Public Repository</b>: <code>https://github.com/username/repo.git</code></div>
              <div>• <b>Private Repository</b>: <code>https://&lt;TOKEN&gt;@github.com/username/repo.git</code></div>
              <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>Generate tokens in GitHub → Settings → Developer Settings → Personal Access Tokens.</div>
            </div>

            <input
              type="text"
              placeholder="https://github.com/username/repository.git"
              value={inputRemoteUrl}
              onChange={e => setInputRemoteUrl(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowRemoteModal(false)} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleSaveRemote} className="btn-primary" style={{ padding: '6px 18px', fontSize: '12px' }}>Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Creator Modal */}
      {showBranchModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '380px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Switch or Create Branch</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Switch to Local Branch:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {branches.map(b => (
                  <button
                    key={b}
                    onClick={() => handleCheckoutBranch(b, false)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: b === currentBranch ? 'var(--accent-primary)' : 'var(--bg-primary)',
                      color: b === currentBranch ? '#fff' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Create New Branch:</label>
              <input
                type="text"
                placeholder="feat/new-feature"
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Cancel</button>
              <button onClick={() => handleCheckoutBranch(newBranchName, true)} disabled={!newBranchName.trim()} className="btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }}>Create & Switch</button>
            </div>
          </div>
        </div>
      )}

      {/* Single File Diff Modal */}
      {diffFilePath && activeWorkspace && (
        <GitDiffModal
          workspaceId={activeWorkspace.id}
          filePath={diffFilePath}
          onClose={() => setDiffFilePath(null)}
        />
      )}

      {/* Commit History Modal */}
      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '520px', maxHeight: '80vh', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Commit Log History</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No commits found yet.</p>
              ) : (
                history.map((h, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{h.message}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{h.author_name}</span>
                      <code style={{ color: 'var(--accent-secondary)' }}>{h.hash?.slice(0, 7)}</code>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
