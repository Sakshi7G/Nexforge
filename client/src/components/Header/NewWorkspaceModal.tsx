import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { FolderPlus, X } from 'lucide-react';

interface NewWorkspaceModalProps {
  onClose: () => void;
}

export const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({ onClose }) => {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    try {
      await createWorkspace(name, description, language);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '460px',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderPlus size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Workspace</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Project / Workspace Name
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. nexforge-ai-core"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Primary Language & Runtime
            </label>
            <select
              className="input-field"
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              <option value="typescript">TypeScript / Node.js</option>
              <option value="javascript">JavaScript / Node.js</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC)</option>
              <option value="go">Go (Golang)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Description (Optional)
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Describe your workspace project..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating Workspace...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
