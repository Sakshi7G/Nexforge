import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { FileNode } from '../../types';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, FilePlus, FolderPlus, Trash2, Edit2, RefreshCw, FolderOutput } from 'lucide-react';

interface FileTreeProps {
  onOpenNewItemModal: (parentPath?: string, defaultIsFolder?: boolean) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ onOpenNewItemModal }) => {
  const { files, activeFilePath, openFile, deleteFileOrFolder, renameOrMove, fetchFileTree } = useWorkspace();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: FileNode } | null>(null);
  const [renamingNode, setRenamingNode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFolderPath(folderPath);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleContainerClick = () => {
    setSelectedFolderPath(null);
  };

  const handleContextMenu = (e: React.MouseEvent, node?: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (node && node.isFolder) {
      setSelectedFolderPath(node.path);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleStartRename = (node: FileNode) => {
    setRenamingNode(node.id);
    setRenameValue(node.path);
    setContextMenu(null);
  };

  const handleConfirmRename = async (node: FileNode) => {
    if (renameValue && renameValue !== node.path) {
      await renameOrMove(node.path, renameValue);
    }
    setRenamingNode(null);
  };

  const renderNode = (node: FileNode, level = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isFolderSelected = selectedFolderPath === node.path;
    const isActiveFile = activeFilePath === node.path;
    const paddingLeft = level * 14 + 10;

    if (node.isFolder) {
      return (
        <div key={node.id}>
          <div
            onClick={(e) => toggleFolder(node.path, e)}
            onContextMenu={e => handleContextMenu(e, node)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              paddingLeft: `${paddingLeft}px`,
              cursor: 'pointer',
              fontSize: '13px',
              color: isFolderSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
              background: isFolderSelected ? 'var(--bg-active)' : 'transparent',
              borderRadius: '4px',
              userSelect: 'none',
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronDown size={14} style={{ marginRight: '4px' }} /> : <ChevronRight size={14} style={{ marginRight: '4px' }} />}
              {isExpanded ? <FolderOpen size={16} color="#d97706" style={{ marginRight: '6px' }} /> : <Folder size={16} color="#d97706" style={{ marginRight: '6px' }} />}
              <span>{node.name}</span>
            </div>

            {/* Quick folder action icons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNewItemModal(node.path, false);
                }}
                title={`New File inside '${node.name}'`}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <FilePlus size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNewItemModal(node.path, true);
                }}
                title={`New Folder inside '${node.name}'`}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <FolderPlus size={13} />
              </button>
            </div>
          </div>

          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.id}
        onClick={(e) => {
          e.stopPropagation();
          openFile(node.path, node.content || '');
        }}
        onContextMenu={e => handleContextMenu(e, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          paddingLeft: `${paddingLeft + 14}px`,
          cursor: 'pointer',
          fontSize: '13px',
          color: isActiveFile ? 'var(--accent-primary)' : 'var(--text-secondary)',
          background: isActiveFile ? 'var(--bg-active)' : 'transparent',
          borderLeft: isActiveFile ? '2px solid var(--accent-primary)' : '2px solid transparent',
          borderRadius: '4px',
          userSelect: 'none'
        }}
      >
        <FileCode size={15} color="var(--accent-secondary)" style={{ marginRight: '6px' }} />
        {renamingNode === node.id ? (
          <input
            type="text"
            className="input-field"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => handleConfirmRename(node)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirmRename(node);
              if (e.key === 'Escape') setRenamingNode(null);
            }}
            autoFocus
            style={{ padding: '2px 4px', fontSize: '12px' }}
          />
        ) : (
          <span>{node.name}</span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleContainerClick}
      onContextMenu={e => handleContextMenu(e)}
      style={{
        width: 'var(--panel-tree-width)',
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* VS Code Style Header Toolbar */}
      <div style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-tertiary)'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          Explorer {selectedFolderPath ? `(${selectedFolderPath.split('/').pop()})` : '(Root)'}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {/* New Independent File */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNewItemModal(selectedFolderPath || undefined, false);
            }}
            title={selectedFolderPath ? `New file inside '${selectedFolderPath}'` : 'New Independent File (Root)'}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '2px' }}
          >
            <FilePlus size={16} />
          </button>

          {/* New Independent Folder */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNewItemModal(selectedFolderPath || undefined, true);
            }}
            title={selectedFolderPath ? `New folder inside '${selectedFolderPath}'` : 'New Independent Folder (Root)'}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '2px' }}
          >
            <FolderPlus size={16} />
          </button>

          {/* Refresh File Tree */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchFileTree();
            }}
            title="Refresh Explorer"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '2px' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Target Folder Indicator */}
      {selectedFolderPath && (
        <div style={{
          padding: '4px 12px',
          background: 'rgba(99, 102, 241, 0.1)',
          color: 'var(--accent-primary)',
          fontSize: '11px',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <span>Targeting: <code>{selectedFolderPath}/</code></span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFolderPath(null);
            }}
            title="Deselect folder to target root level"
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            Deselect
          </button>
        </div>
      )}

      {/* File Tree List Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
        {files.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No files in workspace. Click + to create independent files or folders!
          </div>
        ) : (
          files.map(node => renderNode(node))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            onClick={() => setContextMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 300 }}
          />
          <div className="glass-panel animate-fade-in" style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 301,
            borderRadius: '8px',
            padding: '4px',
            width: '190px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            background: 'var(--bg-secondary)'
          }}>
            {contextMenu.node?.isFolder ? (
              <>
                <button
                  onClick={() => {
                    onOpenNewItemModal(contextMenu.node!.path, false);
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FilePlus size={14} /> New File in Folder
                </button>
                <button
                  onClick={() => {
                    onOpenNewItemModal(contextMenu.node!.path, true);
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FolderPlus size={14} /> New Folder in Folder
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              </>
            ) : !contextMenu.node ? (
              <>
                <button
                  onClick={() => {
                    onOpenNewItemModal(undefined, false);
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FilePlus size={14} /> New Independent File
                </button>
                <button
                  onClick={() => {
                    onOpenNewItemModal(undefined, true);
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FolderPlus size={14} /> New Independent Folder
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              </>
            ) : null}

            {contextMenu.node && (
              <>
                <button
                  onClick={() => handleStartRename(contextMenu.node!)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Edit2 size={14} /> Rename
                </button>
                <button
                  onClick={async () => {
                    await deleteFileOrFolder(contextMenu.node!.path);
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--status-error)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
