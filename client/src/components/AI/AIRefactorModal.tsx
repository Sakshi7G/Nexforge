import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import { Code, Sparkles, X, Check, Code2, Zap, RefreshCw, Wand2, MessageSquare } from 'lucide-react';

interface AIRefactorModalProps {
  selectedCode?: string;
  onClose: () => void;
}

export const AIRefactorModal: React.FC<AIRefactorModalProps> = ({ selectedCode, onClose }) => {
  const { activeWorkspace, activeFilePath, activeFileContent, updateFileContent } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [proposedCode, setProposedCode] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [applied, setApplied] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('Simplify & Modernize Code');

  const targetCode = selectedCode?.trim() || activeFileContent || '';

  const handleRefactor = async (instructionToUse?: string) => {
    if (!activeWorkspace) return;
    const finalInstruction = instructionToUse || customInstruction || selectedPreset;
    setLoading(true);
    setExplanation('');
    setProposedCode('');
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType: 'refactor',
        userPrompt: finalInstruction,
        activeFilePath,
        activeFileContent,
        selectedCode: targetCode
      });

      const responseText = res.data.response || '';
      setExplanation(responseText);

      // Extract final proposed refactored code block
      const codeMatches = Array.from(responseText.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)) as RegExpExecArray[];
      if (codeMatches.length > 0) {
        const lastCodeBlock = codeMatches[codeMatches.length - 1][1].trim();
        setProposedCode(lastCodeBlock);
      }
    } catch (err) {
      console.error('AI Refactor Error:', err);
      setExplanation('Failed to generate code refactoring. Please check your network and Gemini API key.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefactor(selectedPreset);
  }, []);

  const handleApplyRefactor = async () => {
    if (activeFilePath && proposedCode) {
      await updateFileContent(activeFilePath, proposedCode);
      setApplied(true);
      setTimeout(() => onClose(), 1200);
    }
  };

  // Render Visual Line Diff View
  const renderVisualDiff = () => {
    if (!targetCode || !proposedCode) return null;

    const originalLines = targetCode.split('\n');
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
            <span>Refactored Code Diff Inspection</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Green = Added / Refactored | Red = Replaced
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

  const presets = [
    { label: '🧹 Simplify & Modernize Syntax', prompt: 'Simplify and modernize code syntax using ES6+ async/await and clean structure' },
    { label: '⚡ Optimize Performance & Complexity', prompt: 'Optimize algorithm efficiency, reduce loops, and improve time/space complexity' }
  ];

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
        width: '750px',
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
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
            }}>
              <Wand2 size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Gemini AI Code Refactor Assistant
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {selectedCode ? 'Refactoring selected code snippet' : `Refactoring ${activeFilePath || 'active file'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Refactor Presets Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { setSelectedPreset(p.prompt); handleRefactor(p.prompt); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: selectedPreset === p.prompt ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: selectedPreset === p.prompt ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-primary)' }}>
              <Sparkles size={36} className="animate-pulse" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                Gemini AI is refactoring code structure & optimizing logic...
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Improving readability, performance, and syntax standards
              </span>
            </div>
          )}

          {explanation && !loading && (
            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={16} /> Refactoring Summary & Improvements Made
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{explanation}</div>
            </div>
          )}

          {proposedCode && !loading && renderVisualDiff()}
        </div>

        {/* Custom Instruction Input Bar */}
        <form onSubmit={e => { e.preventDefault(); handleRefactor(); }} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Custom refactor instruction (e.g. 'Convert to TypeScript types', 'Use arrow functions')..."
            value={customInstruction}
            onChange={e => setCustomInstruction(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-secondary" disabled={loading || !customInstruction.trim()} style={{ fontSize: '12px' }}>
            <RefreshCw size={14} /> Refactor
          </button>
        </form>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '12px' }}>Dismiss</button>
          {proposedCode && (
            <button
              onClick={handleApplyRefactor}
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
                  <Check size={16} /> Applied Refactored Code to File!
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Accept & Apply Refactored Code
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
