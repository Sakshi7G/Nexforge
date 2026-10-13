import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { FileCode, X, Plus, Minus, Loader2 } from 'lucide-react';

interface GitDiffModalProps {
  workspaceId: string;
  filePath: string;
  onClose: () => void;
}

export const GitDiffModal: React.FC<GitDiffModalProps> = ({ workspaceId, filePath, onClose }) => {
  const [diffText, setDiffText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiff = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/workspaces/${workspaceId}/git/diff?filePath=${encodeURIComponent(filePath)}`);
        setDiffText(res.data.diff || 'No unstaged changes for this file.');
      } catch (err) {
        console.error(err);
        setDiffText('Failed to load file diff.');
      } finally {
        setLoading(false);
      }
    };
    fetchDiff();
  }, [workspaceId, filePath]);

  const renderDiffLines = () => {
    if (!diffText) return <p style={{ color: 'var(--text-secondary)', padding: '16px' }}>Working directory clean.</p>;

    const lines = diffText.split('\n');
    return lines.map((line, i) => {
      let bg = 'transparent';
      let color = 'var(--text-primary)';
      let symbol = '';

      if (line.startsWith('+') && !line.startsWith('+++')) {
        bg = 'rgba(16, 185, 129, 0.15)';
        color = '#10b981';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        bg = 'rgba(244, 63, 94, 0.15)';
        color = '#f43f5e';
      } else if (line.startsWith('@@')) {
        bg = 'rgba(99, 102, 241, 0.15)';
        color = '#818cf8';
      }

      return (
        <div
          key={i}
          style={{
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            padding: '2px 12px',
            background: bg,
            color: color,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {line}
        </div>
      );
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '760px',
        maxWidth: '95vw',
        maxHeight: '85vh',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Git File Diff:</span>
            <code style={{ fontSize: '13px', color: 'var(--accent-secondary)' }}>{filePath}</code>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)', gap: '8px' }}>
              <Loader2 size={18} className="animate-spin" /> Loading git diff...
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {renderDiffLines()}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px 16px', fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
