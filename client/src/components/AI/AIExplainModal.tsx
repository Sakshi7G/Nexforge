import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import { HelpCircle, Sparkles, X, Code, Send, BookOpen, Clock, Zap, MessageSquare } from 'lucide-react';

interface AIExplainModalProps {
  selectedCode?: string;
  onClose: () => void;
}

export const AIExplainModal: React.FC<AIExplainModalProps> = ({ selectedCode, onClose }) => {
  const { activeWorkspace, activeFilePath, activeFileContent } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

  const targetCode = selectedCode?.trim() || activeFileContent || '';

  const handleExplainCode = async (userQuestion = '') => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType: 'explain',
        userPrompt: userQuestion,
        activeFilePath,
        activeFileContent,
        selectedCode: targetCode
      });

      const responseText = res.data.response || '';
      if (!userQuestion) {
        setExplanation(responseText);
      } else {
        setChatHistory(prev => [
          ...prev,
          { role: 'user', content: userQuestion },
          { role: 'assistant', content: responseText }
        ]);
        setFollowUpPrompt('');
      }
    } catch (err) {
      console.error('AI Explain Error:', err);
      setExplanation('Failed to generate code explanation. Please check your network and Gemini API key.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleExplainCode();
  }, []);

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPrompt.trim() || loading) return;
    handleExplainCode(followUpPrompt.trim());
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
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)'
            }}>
              <HelpCircle size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Gemini AI Code Explainer
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {selectedCode ? 'Explaining selected code snippet' : `Explaining ${activeFilePath || 'active file'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Selected Code Snippet Preview Box */}
        {targetCode && (
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            maxHeight: '120px',
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Code size={13} /> Code Under Analysis:
            </div>
            <pre style={{ margin: 0, fontFamily: "'Fira Code', monospace", fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {targetCode.length > 500 ? targetCode.slice(0, 500) + '\n... [truncated]' : targetCode}
            </pre>
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading && !explanation && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-primary)' }}>
              <Sparkles size={36} className="animate-pulse" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                Gemini AI is analyzing code structure and logic flow...
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Generating overview, step-by-step breakdown & complexity analysis
              </span>
            </div>
          )}

          {explanation && (
            <div style={{
              background: 'var(--bg-primary)',
              padding: '16px',
              borderRadius: '10px',
              fontSize: '13px',
              lineHeight: '1.6',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontWeight: 700, color: '#06b6d4', marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} /> Structured Code Explanation
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {explanation}
              </div>
            </div>
          )}

          {/* Follow-up conversation history */}
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                background: msg.role === 'user' ? 'var(--bg-active)' : 'var(--bg-primary)',
                border: msg.role === 'user' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                lineHeight: '1.5'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: msg.role === 'user' ? 'var(--accent-primary)' : '#06b6d4', marginBottom: '4px' }}>
                {msg.role === 'user' ? 'You' : 'Gemini AI'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && explanation && (
            <div style={{ fontSize: '12px', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} className="animate-pulse" /> Gemini AI is responding to your follow-up...
            </div>
          )}
        </div>

        {/* Interactive Follow-up Question Bar */}
        <form onSubmit={handleFollowUpSubmit} style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Ask a follow-up question (e.g. 'Explain line 4 in more detail' or 'Can we optimize this?')..."
            value={followUpPrompt}
            onChange={e => setFollowUpPrompt(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !followUpPrompt.trim()} style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
