import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { X, FileCode } from 'lucide-react';

export const FileTabs: React.FC = () => {
  const { openTabs, activeFilePath, openFile, closeTab } = useWorkspace();

  if (openTabs.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
      height: '36px'
    }}>
      {openTabs.map(tabPath => {
        const isActive = tabPath === activeFilePath;
        const fileName = tabPath.split('/').pop() || tabPath;

        return (
          <div
            key={tabPath}
            onClick={() => openFile(tabPath)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              height: '100%',
              background: isActive ? 'var(--bg-secondary)' : 'transparent',
              borderRight: '1px solid var(--border-color)',
              borderTop: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              userSelect: 'none',
              minWidth: '120px',
              maxWidth: '200px'
            }}
          >
            <FileCode size={14} color={isActive ? 'var(--accent-secondary)' : 'var(--text-muted)'} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400 }}>
              {fileName}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tabPath);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '4px'
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
