import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../api/socket';
import api from '../../api/client';
import {
  FileText, Plus, Search, Trash2, Edit2, Check, X, Eye, Edit3,
  CheckCircle2, Loader2, Users, Sparkles, Clock, BookOpen
} from 'lucide-react';

interface NoteItem {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  authorId?: string;
  createdAt: string;
  updatedAt: string;
}

interface NoteViewer {
  socketId: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  color?: string;
}

export const NotesPanel: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const socket = getSocket();

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [viewers, setViewers] = useState<NoteViewer[]>([]);
  const [loading, setLoading] = useState(true);

  const saveTimerRef = useRef<any>(null);
  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  // 1. Fetch notes list from backend
  const fetchNotes = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const res = await api.get(`/workspaces/${activeWorkspace.id}/notes`);
      const fetchedNotes: NoteItem[] = res.data.notes || [];
      setNotes(fetchedNotes);

      if (fetchedNotes.length > 0 && !activeNoteId) {
        setActiveNoteId(fetchedNotes[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // 2. Real-time workspace note list mutations (create/delete)
  useEffect(() => {
    if (!activeWorkspace) return;

    const handleNotesMutation = ({ action, note }: { action: 'create' | 'delete' | 'update'; note: any }) => {
      if (action === 'create' && note) {
        setNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
      } else if (action === 'delete' && note?.id) {
        setNotes(prev => prev.filter(n => n.id !== note.id));
        if (activeNoteId === note.id) {
          setActiveNoteId(null);
        }
      }
    };

    const handleTitleChange = ({ noteId, title }: { noteId: string; title: string }) => {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title } : n));
    };

    socket.on('notes:mutation', handleNotesMutation);
    socket.on('notes:title-change', handleTitleChange);

    return () => {
      socket.off('notes:mutation', handleNotesMutation);
      socket.off('notes:title-change', handleTitleChange);
    };
  }, [activeWorkspace, activeNoteId]);

  // 3. Real-time note room join & content co-authoring sync
  useEffect(() => {
    if (!activeWorkspace || !activeNoteId || !user) return;

    // Join room for the active note
    socket.emit('notes:join-note', {
      workspaceId: activeWorkspace.id,
      noteId: activeNoteId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl
    });

    const handleViewersUpdate = ({ noteId, viewers }: { noteId: string; viewers: NoteViewer[] }) => {
      if (noteId === activeNoteId) {
        setViewers(viewers);
      }
    };

    const handleRemoteContentChange = ({ noteId, content, senderSocketId }: { noteId: string; content: string; senderSocketId: string }) => {
      if (noteId === activeNoteId && senderSocketId !== socket.id) {
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content } : n));
      }
    };

    socket.on('notes:viewers-update', handleViewersUpdate);
    socket.on('notes:content-change', handleRemoteContentChange);

    return () => {
      socket.emit('notes:leave-note', { noteId: activeNoteId });
      socket.off('notes:viewers-update', handleViewersUpdate);
      socket.off('notes:content-change', handleRemoteContentChange);
    };
  }, [activeWorkspace, activeNoteId, user]);

  // Create a new note
  const handleCreateNote = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/notes`, {
        title: 'Untitled Note',
        content: ''
      });
      const newNote: NoteItem = res.data.note;
      setNotes(prev => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      setEditingTitleId(newNote.id);
      setTempTitle('Untitled Note');

      socket.emit('notes:mutation', {
        workspaceId: activeWorkspace.id,
        action: 'create',
        note: newNote
      });
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  // Delete a note
  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (activeNoteId === noteId) {
        const remaining = notes.filter(n => n.id !== noteId);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }

      socket.emit('notes:mutation', {
        workspaceId: activeWorkspace.id,
        action: 'delete',
        note: { id: noteId }
      });
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Rename a note title
  const handleSaveTitle = async (noteId: string) => {
    if (!activeWorkspace) return;
    const finalTitle = tempTitle.trim() || 'Untitled Note';
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: finalTitle } : n));
    setEditingTitleId(null);

    socket.emit('notes:title-change', {
      workspaceId: activeWorkspace.id,
      noteId,
      title: finalTitle
    });

    try {
      await api.put(`/workspaces/${activeWorkspace.id}/notes/${noteId}`, { title: finalTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Handle live content edit with debounced auto-save & instant socket broadcast
  const handleContentChange = (newContent: string) => {
    if (!activeNoteId || !activeWorkspace) return;

    setSaveStatus('saving');

    // Update local state instantly
    setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, content: newContent } : n));

    // Broadcast live typing stroke over WebSockets
    socket.emit('notes:content-change', {
      workspaceId: activeWorkspace.id,
      noteId: activeNoteId,
      content: newContent
    });

    // Debounced API auto-save to database (800ms)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.put(`/workspaces/${activeWorkspace.id}/notes/${activeNoteId}`, { content: newContent });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 800);
  };

  // Render Markdown formatting preview
  const renderMarkdown = (text: string) => {
    if (!text) return <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Empty note. Start typing your ideas above...</p>;

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) return <h1 key={idx} style={{ fontSize: '22px', fontWeight: '800', margin: '14px 0 8px 0', color: 'var(--text-primary)' }}>{line.replace('# ', '')}</h1>;
      if (line.startsWith('## ')) return <h2 key={idx} style={{ fontSize: '18px', fontWeight: '700', margin: '12px 0 6px 0', color: 'var(--text-primary)' }}>{line.replace('## ', '')}</h2>;
      if (line.startsWith('### ')) return <h3 key={idx} style={{ fontSize: '15px', fontWeight: '700', margin: '10px 0 4px 0', color: 'var(--text-primary)' }}>{line.replace('### ', '')}</h3>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={idx} style={{ marginLeft: '20px', margin: '4px 0', color: 'var(--text-primary)' }}>{line.substring(2)}</li>;
      if (line.startsWith('> ')) return <blockquote key={idx} style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: '12px', margin: '8px 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{line.replace('> ', '')}</blockquote>;
      if (line.trim() === '') return <br key={idx} />;

      return <p key={idx} style={{ margin: '4px 0', lineHeight: '1.6', color: 'var(--text-primary)' }}>{line}</p>;
    });
  };

  const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* LEFT PANE: Notes Master Directory List */}
      <div style={{
        width: '280px',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        userSelect: 'none'
      }}>
        {/* Header Bar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Team Notes</span>
            <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '11px', padding: '2px 6px', borderRadius: '10px', fontWeight: '600' }}>
              {notes.length}
            </span>
          </div>

          <button
            onClick={handleCreateNote}
            title="Create New Note"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '6px 10px'
          }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-secondary)', fontSize: '12px', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" /> Loading notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>
              <BookOpen size={24} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p>No notes found.</p>
              <button onClick={handleCreateNote} style={{ marginTop: '8px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline' }}>
                Create one now
              </button>
            </div>
          ) : (
            filteredNotes.map(n => {
              const isSelected = n.id === activeNoteId;
              const isEditingThisTitle = editingTitleId === n.id;

              return (
                <div
                  key={n.id}
                  onClick={() => setActiveNoteId(n.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {isEditingThisTitle ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={tempTitle}
                          onChange={e => setTempTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(n.id); }}
                          autoFocus
                          style={{
                            flex: 1,
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            padding: '2px 6px',
                            outline: 'none'
                          }}
                        />
                        <button onClick={() => handleSaveTitle(n.id)} style={{ border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: isSelected ? '700' : '600', fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {n.title}
                      </span>
                    )}

                    {!isEditingThisTitle && isSelected && (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingTitleId(n.id);
                            setTempTitle(n.title);
                          }}
                          title="Rename Note"
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={e => handleDeleteNote(n.id, e)}
                          title="Delete Note"
                          style={{ border: 'none', background: 'transparent', color: 'var(--status-error)', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> {new Date(n.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: Collaborative Note Editor Canvas */}
      {activeNote ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
          
          {/* Editor Header Bar */}
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)'
          }}>
            {/* Note Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {activeNote.title}
              </h2>
            </div>

            {/* Right Controls: Viewer Badges, Auto-Save Status & Preview Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* Active Co-Authors / Viewers Bar */}
              {viewers.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                  <Users size={13} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Viewing:</span>
                  <div style={{ display: 'flex', gap: '-4px' }}>
                    {viewers.map((v, i) => (
                      <div
                        key={v.socketId || i}
                        title={`${v.userName} is co-editing`}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: v.color || '#6366f1',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid var(--bg-secondary)',
                          marginLeft: i > 0 ? '-6px' : '0'
                        }}
                      >
                        {v.userName.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-Save Cloud Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} style={{ color: 'var(--status-success)' }} />
                    <span style={{ color: 'var(--status-success)' }}>Saved</span>
                  </>
                )}
              </div>

              {/* Edit / Markdown Preview Toggle */}
              <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                <button
                  onClick={() => setIsPreviewMode(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    background: !isPreviewMode ? 'var(--accent-primary)' : 'transparent',
                    color: !isPreviewMode ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button
                  onClick={() => setIsPreviewMode(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    background: isPreviewMode ? 'var(--accent-primary)' : 'transparent',
                    color: isPreviewMode ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Eye size={12} /> Preview
                </button>
              </div>

            </div>
          </div>

          {/* Main Body Canvas */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            {!isPreviewMode ? (
              <textarea
                value={activeNote.content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Type your collaborative team notes here... Supports Markdown (# Heading, - Bullets, > Quote)"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '400px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  lineHeight: '1.7',
                  resize: 'none'
                }}
              />
            ) : (
              <div style={{ padding: '10px', minHeight: '400px' }}>
                {renderMarkdown(activeNote.content)}
              </div>
            )}
          </div>

          {/* Footer Stats Bar */}
          <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Words: {activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0} | Characters: {activeNote.content.length}</span>
            <span>Real-Time Collaborative Markdown Sync</span>
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>No Note Selected</h3>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>Select a note from the left sidebar or create a new one.</p>
          <button
            onClick={handleCreateNote}
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Create New Note
          </button>
        </div>
      )}

    </div>
  );
};
