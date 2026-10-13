import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import { Bug, Sparkles, Check, X, Code2, AlertTriangle, ArrowRight, ShieldAlert, FileCode } from 'lucide-react';

interface AIDebuggerModalProps {
  errorLog?: string;
  onClose: () => void;
}

export const AIDebuggerModal: React.FC<AIDebuggerModalProps> = ({ errorLog = '', onClose }) => {
  const { activeWorkspace, activeFilePath, activeFileContent, updateFileContent } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [proposedCode, setProposedCode] = useState('');
  const [applied, setApplied] = useState(false);
  const [mode, setMode] = useState<'scan' | 'runtime'>(errorLog.trim() ? 'runtime' : 'scan');

  // Trigger analysis on click or mount
  const handleRunAnalysis = async (overrideMode?: 'scan' | 'runtime') => {
    if (!activeWorkspace) return;
    const currentMode = overrideMode || mode;
    setLoading(true);
    setExplanation('');
    setProposedCode('');
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType: currentMode === 'scan' ? 'scan_bugs' : 'debug',
        errorLog: currentMode === 'runtime' ? errorLog : undefined,
        activeFilePath,
        activeFileContent
      });

      const responseText = res.data.response || '';
      setExplanation(responseText);

      // Extract final proposed replacement code block (last code block in response)
      const codeMatches = Array.from(responseText.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)) as RegExpExecArray[];
      if (codeMatches.length > 0) {
        const lastCodeBlock = codeMatches[codeMatches.length - 1][1].trim();
        setProposedCode(lastCodeBlock);
      }
    } catch (err) {
      console.error('AI Bug Scan Error:', err);
      setExplanation('Failed to run AI bug scanner. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunAnalysis();
  }, []);

  const handleApplyFix = async () => {
    if (activeFilePath && proposedCode) {
      await updateFileContent(activeFilePath, proposedCode);
      setApplied(true);
      setTimeout(() => onClose(), 1200);
    }
  };

  // Render Visual Line Diff
  const renderVisualDiff = () => {
    if (!activeFileContent || !proposedCode) return null;

    const originalLines = activeFileContent.split('\n');
    const proposedLines = proposedCode.split('\n');

    return (
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
        marginTop: '12px'
      }}>
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Code2 size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>AI Code Patch Preview (Diff View)</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Green = Added / Modified | Red = Removed
          </span>
        </div>

        <div style={{
          maxHeight: '220px',
          overflowY: 'auto',
          padding: '8px 0',
          fontFamily: "'Fira Code', Monaco, monospace",
          fontSize: '12px',
          lineHeight: '1.6'
        }}>
          {proposedLines.map((line, idx) => {
            const isNew = !originalLines.includes(line);
            return (
              <div
                key={idx}
                style={{
                  padding: '2px 12px',
                  background: isNew ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: isNew ? '#10b981' : 'var(--text-primary)',
                  fontWeight: isNew ? 600 : 400,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {isNew ? `+ ${line}` : `  ${line}`}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '740px',
        maxWidth: '92vw',
        maxHeight: '88vh',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)'
            }}>
              <Bug size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {mode === 'runtime' ? 'Gemini AI Runtime Debugger & Auto-Fixer' : 'Gemini AI Proactive Bug Scanner'}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {activeFilePath ? `Target: ${activeFilePath}` : 'Analyzing codebase for potential bugs & fixes'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { setMode('scan'); handleRunAnalysis('scan'); }}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: '6px',
              background: mode === 'scan' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'scan' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <ShieldAlert size={14} /> Scan Active File for Bugs
          </button>
          {errorLog && (
            <button
              onClick={() => { setMode('runtime'); handleRunAnalysis('runtime'); }}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                background: mode === 'runtime' ? 'var(--status-error)' : 'transparent',
                color: mode === 'runtime' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Bug size={14} /> Runtime Stack Trace Debugger
            </button>
          )}
        </div>

        {/* Error Trace Display if Runtime mode */}
        {mode === 'runtime' && errorLog && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid var(--status-error)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            fontFamily: "'Fira Code', monospace",
            color: '#fda4af',
            maxHeight: '90px',
            overflowY: 'auto',
            marginBottom: '16px'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} /> Console Error Output:
            </div>
            {errorLog}
          </div>
        )}

        {/* Analysis Body */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-primary)' }}>
              <Sparkles size={36} className="animate-pulse" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                {mode === 'scan' ? 'Gemini AI is scanning active file for bugs & vulnerabilities...' : 'Gemini AI is analyzing error stack trace & line context...'}
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Evaluating logic errors, edge cases, and type safety</span>
            </div>
          )}

          {explanation && !loading && (
            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} /> AI Diagnosis & Root Cause Analysis
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{explanation}</div>
            </div>
          )}

          {proposedCode && !loading && renderVisualDiff()}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button onClick={() => handleRunAnalysis()} className="btn-secondary" disabled={loading} style={{ fontSize: '12px' }}>
            <Sparkles size={14} /> Re-scan File
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn-secondary" style={{ fontSize: '12px' }}>Dismiss</button>
            {proposedCode && (
              <button
                onClick={handleApplyFix}
                className="btn-primary"
                disabled={applied}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                {applied ? (
                  <>
                    <Check size={16} /> Applied Patch to File!
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Accept & Apply AI Code Fix
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
