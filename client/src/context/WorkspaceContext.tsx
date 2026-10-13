import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { getSocket } from '../api/socket';
import { Workspace, FileNode, UserPresence } from '../types';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  files: FileNode[];
  activeFilePath: string | null;
  activeFileContent: string;
  openTabs: string[];
  presence: UserPresence[];
  loading: boolean;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, description: string, language: string) => Promise<Workspace>;
  joinWorkspace: (workspaceIdOrName: string) => Promise<Workspace>;
  selectWorkspace: (workspace: Workspace) => void;
  openFile: (path: string, content?: string) => void;
  closeTab: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  createFileOrFolder: (path: string, isFolder: boolean, content?: string) => Promise<void>;
  deleteFileOrFolder: (path: string) => Promise<void>;
  renameOrMove: (oldPath: string, newPath: string) => Promise<void>;
  fetchFileTree: () => Promise<void>;
}

const findFileByPath = (nodes: FileNode[], targetPath: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findFileByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
};

const updateNodeContentInTree = (nodes: FileNode[], targetPath: string, content: string): FileNode[] => {
  return nodes.map(node => {
    if (node.path === targetPath) {
      return { ...node, content };
    }
    if (node.children) {
      return { ...node, children: updateNodeContentInTree(node.children, targetPath, content) };
    }
    return node;
  });
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(false);

  const socket = getSocket();

  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/workspaces');
      setWorkspaces(res.data.workspaces);
      if (res.data.workspaces.length > 0 && !activeWorkspace) {
        selectWorkspace(res.data.workspaces[0]);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  const fetchFileTree = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspace.id}/files`);
      const updatedFiles: FileNode[] = res.data.files || [];
      setFiles(updatedFiles);

      // Auto-refresh active editor content if the open file was updated on disk (e.g. via git pull)
      setActiveFilePath(currentPath => {
        if (currentPath) {
          const matching = findFileByPath(updatedFiles, currentPath);
          if (matching && typeof matching.content === 'string') {
            setActiveFileContent(matching.content);
          }
        }
        return currentPath;
      });
    } catch (err) {
      console.error('Failed to fetch file tree:', err);
    }
  }, [activeWorkspace]);

  const selectWorkspace = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setActiveFilePath(null);
    setActiveFileContent('');
    setOpenTabs([]);
  };

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    } else {
      setActiveWorkspace(null);
      setWorkspaces([]);
      setFiles([]);
      setActiveFilePath(null);
      setActiveFileContent('');
      setOpenTabs([]);
      setPresence([]);
    }
  }, [user]);

  useEffect(() => {
    if (activeWorkspace && user) {
      fetchFileTree();

      // Join real-time workspace room
      socket.emit('workspace:join', {
        workspaceId: activeWorkspace.id,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatarUrl
      });

      // Presence update listener
      const handlePresenceUpdate = (users: UserPresence[]) => {
        setPresence(users);
      };

      // File tree mutation listener
      const handleFileTreeMutation = () => {
        fetchFileTree();
      };

      // Remote content change listener for real-time code sync across tabs & users
      const handleRemoteContentChange = ({ filePath, content }: { filePath: string; content: string }) => {
        setActiveFilePath(currentPath => {
          if (currentPath === filePath) {
            setActiveFileContent(content);
          }
          return currentPath;
        });

        setFiles(prevFiles => updateNodeContentInTree(prevFiles, filePath, content));
      };

      socket.on('presence:update', handlePresenceUpdate);
      socket.on('filetree:mutation', handleFileTreeMutation);
      socket.on('editor:content-change', handleRemoteContentChange);

      // Periodic 4-second background scan to auto-detect terminal-created files (venv, scripts, pip packages)
      const diskSyncInterval = setInterval(() => {
        fetchFileTree();
      }, 4000);

      return () => {
        clearInterval(diskSyncInterval);
        socket.off('presence:update', handlePresenceUpdate);
        socket.off('filetree:mutation', handleFileTreeMutation);
        socket.off('editor:content-change', handleRemoteContentChange);
      };
    }
  }, [activeWorkspace, user, fetchFileTree]);

  const createWorkspace = async (name: string, description: string, language: string): Promise<Workspace> => {
    const res = await api.post('/workspaces', { name, description, language });
    const newWs = res.data.workspace;
    setWorkspaces(prev => [newWs, ...prev.filter(w => w.id !== newWs.id)]);
    selectWorkspace(newWs);
    return newWs;
  };

  const joinWorkspace = async (workspaceIdOrName: string): Promise<Workspace> => {
    const res = await api.post(`/workspaces/${encodeURIComponent(workspaceIdOrName)}/join`);
    const joinedWs = res.data.workspace;
    setWorkspaces(prev => [joinedWs, ...prev.filter(w => w.id !== joinedWs.id)]);
    selectWorkspace(joinedWs);
    return joinedWs;
  };



  const openFile = (filePath: string, content?: string) => {
    const fileNode = findFileByPath(files, filePath);
    setActiveFilePath(filePath);
    if (!openTabs.includes(filePath)) {
      setOpenTabs(prev => [...prev, filePath]);
    }
    const finalContent = content !== undefined ? content : (fileNode?.content || '');
    setActiveFileContent(finalContent);

    if (activeWorkspace) {
      socket.emit('presence:active-file', {
        workspaceId: activeWorkspace.id,
        filePath
      });
    }
  };

  const closeTab = (tabPath: string) => {
    const newTabs = openTabs.filter(t => t !== tabPath);
    setOpenTabs(newTabs);
    if (activeFilePath === tabPath) {
      if (newTabs.length > 0) {
        openFile(newTabs[newTabs.length - 1]);
      } else {
        setActiveFilePath(null);
        setActiveFileContent('');
      }
    }
  };

  const updateFileContent = async (filePath: string, content: string) => {
    setActiveFileContent(content);
    if (activeWorkspace) {
      await api.put(`/workspaces/${activeWorkspace.id}/files/content`, { path: filePath, content });
      socket.emit('editor:content-change', {
        workspaceId: activeWorkspace.id,
        filePath,
        content
      });
    }
  };

  const createFileOrFolder = async (filePath: string, isFolder: boolean, content?: string) => {
    if (!activeWorkspace) return;
    await api.post(`/workspaces/${activeWorkspace.id}/files`, { path: filePath, isFolder, content });
    socket.emit('filetree:mutation', { workspaceId: activeWorkspace.id, action: 'create', file: { path: filePath, isFolder } });
    await fetchFileTree();
    if (!isFolder) {
      openFile(filePath, content || '');
    }
  };

  const deleteFileOrFolder = async (filePath: string) => {
    if (!activeWorkspace) return;
    await api.delete(`/workspaces/${activeWorkspace.id}/files`, { data: { path: filePath } });
    socket.emit('filetree:mutation', { workspaceId: activeWorkspace.id, action: 'delete', file: { path: filePath } });
    closeTab(filePath);
    await fetchFileTree();
  };

  const renameOrMove = async (oldPath: string, newPath: string) => {
    if (!activeWorkspace) return;
    await api.put(`/workspaces/${activeWorkspace.id}/files/rename`, { oldPath, newPath });
    socket.emit('filetree:mutation', { workspaceId: activeWorkspace.id, action: 'rename' });
    closeTab(oldPath);
    await fetchFileTree();
  };

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      files,
      activeFilePath,
      activeFileContent,
      openTabs,
      presence,
      loading,
      fetchWorkspaces,
      createWorkspace,
      joinWorkspace,
      selectWorkspace,
      openFile,
      closeTab,
      updateFileContent,
      createFileOrFolder,
      deleteFileOrFolder,
      renameOrMove,
      fetchFileTree
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
