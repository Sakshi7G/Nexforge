import React from 'react';
import { Files, Bot, GitBranch, MessageSquare, Video, Edit3, FileText, Table, Terminal as TerminalIcon } from 'lucide-react';

export type ActiveSidePanel = 'files' | 'ai' | 'git' | 'chat' | 'video' | 'whiteboard' | 'notes' | 'sheets' | 'terminal';

interface SidebarNavigationProps {
  activePanel: ActiveSidePanel;
  onSelectPanel: (panel: ActiveSidePanel) => void;
  unreadChatCount?: number;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  activePanel,
  onSelectPanel,
  unreadChatCount = 0
}) => {
  const items = [
    { id: 'files', icon: Files, label: 'Explorer' },
    { id: 'ai', icon: Bot, label: 'AI Assistant' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'chat', icon: MessageSquare, label: 'Team Chat', badge: unreadChatCount },
    { id: 'video', icon: Video, label: 'Google Meet Video Call' },
    { id: 'whiteboard', icon: Edit3, label: 'Synced Whiteboard' },
    { id: 'notes', icon: FileText, label: 'Collaborative Notes' },
    { id: 'sheets', icon: Table, label: 'Data Sheets / Excel Studio' }
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100%',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: '16px',
      zIndex: 50
    }}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectPanel(item.id as ActiveSidePanel)}
            title={item.label}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isActive ? 'var(--bg-active)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.2s ease'
            }}
          >
            <Icon size={20} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
            {item.badge ? (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-primary)'
              }} />
            ) : null}
          </button>
        );
      })}
    </aside>
  );
};
