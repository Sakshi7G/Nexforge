export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'owner' | 'editor' | 'viewer';
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  language: string;
  ownerId: string;
  owner?: User;
  members?: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  content?: string | null;
  parentId?: string | null;
  children?: FileNode[];
}

export interface UserPresence {
  userId: string;
  userName: string;
  userAvatar?: string;
  activeFilePath?: string;
  color: string;
  cursor?: { lineNumber: number; column: number };
  selection?: any;
}

export interface ChatMessage {
  id: string;
  workspaceId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  promptType?: string;
  codeContext?: string;
  createdAt: string;
}

export interface AISession {
  id: string;
  workspaceId: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
}

export interface GitStatus {
  isRepo: boolean;
  currentBranch?: string;
  staged: string[];
  modified: string[];
  not_added: string[];
  deleted: string[];
  files: any[];
}
