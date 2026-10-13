import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../api/socket';
import { ChatMessage } from '../../types';
import { MessageSquare, Send, Users } from 'lucide-react';

interface ChatPanelProps {
  width?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ width = 340 }) => {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const socket = getSocket();

  useEffect(() => {
    if (!activeWorkspace) return;

    socket.emit('chat:join', { workspaceId: activeWorkspace.id });

    socket.on('chat:history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('chat:typing', ({ userName, isTyping }: { userName: string; isTyping: boolean }) => {
      if (isTyping) {
        setTypingUser(userName);
      } else {
        setTypingUser(null);
      }
    });

    return () => {
      socket.off('chat:history');
      socket.off('chat:message');
      socket.off('chat:typing');
    };
  }, [activeWorkspace]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeWorkspace || !user) return;

    socket.emit('chat:send', {
      workspaceId: activeWorkspace.id,
      userId: user.id,
      content: inputText
    });

    setInputText('');
    socket.emit('chat:typing', { workspaceId: activeWorkspace.id, userName: user.name, isTyping: false });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (activeWorkspace && user) {
      socket.emit('chat:typing', {
        workspaceId: activeWorkspace.id,
        userName: user.name,
        isTyping: e.target.value.length > 0
      });
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
        gap: '8px'
      }}>
        <MessageSquare size={18} color="var(--accent-primary)" />
        <span style={{ fontWeight: 700, fontSize: '13px' }}>Workspace Team Chat</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map(m => {
          const isSelf = m.userId === user?.id;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isSelf ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                gap: '8px'
              }}
            >
              {!isSelf && (
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700
                }}>
                  {m.user?.name ? m.user.name.slice(0, 2).toUpperCase() : 'U'}
                </div>
              )}
              <div style={{
                background: isSelf ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '13px'
              }}>
                {!isSelf && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{m.user?.name}</div>}
                <div>{m.content}</div>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {typingUser} is typing...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Type message..."
          value={inputText}
          onChange={handleInputChange}
        />
        <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
