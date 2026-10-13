import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import { Bot, Send, Sparkles, Code, HelpCircle, ShieldCheck, FileText, Key, Check } from 'lucide-react';
import { AIMessage } from '../../types';

interface AIChatPanelProps {
  width?: number;
  initialPromptType?: string;
  initialSelectedCode?: string;
  initialErrorLog?: string;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  width = 340,
  initialPromptType,
  initialSelectedCode,
  initialErrorLog
}) => {
  const { activeWorkspace, activeFilePath, activeFileContent } = useWorkspace();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Key setting state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      api.get(`/workspaces/${activeWorkspace.id}/ai/history`).then(res => {
        if (res.data.sessions && res.data.sessions.length > 0) {
          setSessionId(res.data.sessions[0].id);
          setMessages(res.data.sessions[0].messages || []);
        }
      }).catch(err => console.error(err));
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (initialPromptType && activeWorkspace) {
      handleSendAIRequest(initialPromptType, '', initialSelectedCode, initialErrorLog);
    }
  }, [initialPromptType, initialSelectedCode, initialErrorLog]);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    try {
      await api.post('/workspaces/ai/config-key', { apiKey: apiKeyInput.trim() });
      setKeySaved(true);
      setTimeout(() => {
        setKeySaved(false);
        setShowKeyModal(false);
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendAIRequest = async (
    promptType = 'chat',
    customPrompt = '',
    selectedCode?: string,
    errorLog?: string
  ) => {
    if (!activeWorkspace) return;
    const promptText = customPrompt || inputPrompt;
    if (!promptText && !selectedCode && !errorLog && promptType === 'chat') return;

    setLoading(true);

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      sessionId: sessionId || 'temp',
      role: 'user',
      content: promptText || `${promptType.toUpperCase()} Request`,
      promptType,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (promptType === 'chat') setInputPrompt('');

    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType,
        userPrompt: promptText,
        activeFilePath,
        activeFileContent,
        selectedCode,
        errorLog,
        sessionId
      });

      if (res.data.sessionId) setSessionId(res.data.sessionId);

      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        sessionId: res.data.sessionId,
        role: 'assistant',
        content: res.data.response,
        promptType,
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sessionId: 'err',
          role: 'assistant',
          content: 'Error calling Gemini AI: ' + (err.response?.data?.error || err.message),
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: `${width}px`,
      height: '100%',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>NexForge Gemini AI</span>
        </div>

        <button
          onClick={() => setShowKeyModal(true)}
          title="Set Gemini API Key"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--accent-primary)',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Key size={12} /> Key
        </button>
      </div>

      {/* Quick AI Presets */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => handleSendAIRequest('explain')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          <HelpCircle size={12} color="var(--accent-secondary)" /> Explain
        </button>
        <button
          onClick={() => handleSendAIRequest('review')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          <ShieldCheck size={12} color="var(--status-success)" /> Review
        </button>
        <button
          onClick={() => handleSendAIRequest('test')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          <Code size={12} color="#ec4899" /> Gen Tests
        </button>
        <button
          onClick={() => handleSendAIRequest('doc')}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          <FileText size={12} color="#f59e0b" /> Gen Docs
        </button>
      </div>

      {/* Messages Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '30px' }}>
            <Sparkles size={28} color="var(--accent-primary)" style={{ marginBottom: '8px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>How can I help you build?</p>
            <p style={{ fontSize: '12px' }}>Ask questions, generate code, debug errors, or request refactoring.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                background: msg.role === 'user' ? 'var(--bg-active)' : 'var(--bg-primary)',
                border: msg.role === 'user' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: '1.5'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--accent-secondary)', marginBottom: '4px' }}>
                {msg.role === 'user' ? 'You' : 'Gemini AI Assistant'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: msg.content.includes('```') ? "'Fira Code', monospace" : 'inherit' }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ fontSize: '12px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} className="animate-pulse" />
            Gemini is reasoning and writing code...
          </div>
        )}
      </div>

      {/* Prompt Input Box */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendAIRequest('chat');
        }}
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px'
        }}
      >
        <input
          type="text"
          className="input-field"
          placeholder="Ask Gemini AI..."
          value={inputPrompt}
          onChange={e => setInputPrompt(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !inputPrompt.trim()}
          style={{ padding: '8px 12px' }}
        >
          <Send size={14} />
        </button>
      </form>

      {/* Set API Key Modal */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '380px', padding: '24px', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Configure Gemini API Key</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Paste your Google Gemini API Key below to enable live LLM pair-programming.
            </p>

            <form onSubmit={handleSaveApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                className="input-field"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                required
                autoFocus
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowKeyModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {keySaved ? <><Check size={14} /> Saved!</> : 'Save Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
