import React from 'react';
import { Play, Sparkles, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface ExecutionConsoleProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  isRunning: boolean;
  onAutoFixError?: (stderr: string) => void;
  onClose?: () => void;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  stdout,
  stderr,
  exitCode,
  isRunning,
  onAutoFixError,
  onClose
}) => {
  return (
    <div style={{
      height: '200px',
      background: 'var(--bg-primary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Console Header */}
      <div style={{
        padding: '6px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <Play size={14} color="#10b981" />
          <span>Docker Execution Runner Console</span>
          {isRunning && (
            <span style={{ fontSize: '11px', color: 'var(--status-warning)', marginLeft: '8px' }}>
              ● Running inside sandbox container...
            </span>
          )}
          {!isRunning && exitCode !== null && (
            <span style={{
              fontSize: '11px',
              color: exitCode === 0 ? 'var(--status-success)' : 'var(--status-error)',
              marginLeft: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {exitCode === 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              Exit Code: {exitCode}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(stderr || (exitCode !== null && exitCode !== 0)) && onAutoFixError && (
            <button
              onClick={() => onAutoFixError(stderr || `Process exited with code ${exitCode}`)}
              className="btn-primary animate-pulse"
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                boxShadow: '0 2px 10px rgba(168, 85, 247, 0.4)',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Click to let Gemini AI analyze error & patch code automatically"
            >
              <Sparkles size={12} />
              🤖 AI 1-Click Auto-Fix
            </button>
          )}
          {onClose && (
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Output Content */}
      <div style={{
        flex: 1,
        padding: '12px',
        fontFamily: "'Fira Code', monospace",
        fontSize: '13px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap'
      }}>
        {stdout && (
          <div style={{ color: '#f8fafc', marginBottom: '8px' }}>
            {stdout}
          </div>
        )}
        {stderr && (
          <div style={{ color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '8px', borderRadius: '6px' }}>
            {stderr}
          </div>
        )}
        {!stdout && !stderr && !isRunning && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Press "Run Code" in the top bar to execute inside isolated Docker container.
          </div>
        )}
      </div>
    </div>
  );
};
