import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { FilePlus, FolderPlus, X } from 'lucide-react';

interface NewItemModalProps {
  onClose: () => void;
  defaultParentPath?: string;
  defaultIsFolder?: boolean;
}

export const NewItemModal: React.FC<NewItemModalProps> = ({
  onClose,
  defaultParentPath = '',
  defaultIsFolder = false
}) => {
  const { createFileOrFolder } = useWorkspace();
  const [name, setName] = useState('');
  const [isFolder, setIsFolder] = useState(defaultIsFolder);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsFolder(defaultIsFolder);
  }, [defaultIsFolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const cleanName = name.trim().replace(/^\/+/, '');
      const fullPath = defaultParentPath ? `${defaultParentPath}/${cleanName}` : cleanName;

      let starterContent = '// New code file\n';
      const ext = cleanName.split('.').pop()?.toLowerCase();
      if (ext === 'py') {
        starterContent = '# Python code file\nprint("Hello World!")\n';
      } else if (ext === 'cpp' || ext === 'c') {
        starterContent = '#include <iostream>\n\nint main() {\n    std::cout << "Hello World!" << std::endl;\n    return 0;\n}\n';
      } else if (ext === 'go') {
        starterContent = 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello World!")\n}\n';
      }

      await createFileOrFolder(fullPath, isFolder, isFolder ? undefined : starterContent);
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
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '420px',
        borderRadius: '14px',
        padding: '24px',
        background: 'var(--bg-secondary)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isFolder ? <FolderPlus size={22} color="var(--accent-primary)" /> : <FilePlus size={22} color="var(--accent-primary)" />}
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Create New {isFolder ? 'Folder' : 'File'}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {defaultParentPath && (
          <div style={{
            fontSize: '12px',
            color: 'var(--accent-primary)',
            background: 'rgba(79, 70, 229, 0.08)',
            padding: '6px 10px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontWeight: 500
          }}>
            Creating inside: <code>{defaultParentPath}/</code>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Type
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={!isFolder ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setIsFolder(false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                File
              </button>
              <button
                type="button"
                className={isFolder ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setIsFolder(true)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Folder
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              {isFolder ? 'Folder Name' : 'File Name (e.g. first.py, index.js)'}
            </label>
            <input
              type="text"
              className="input-field"
              placeholder={isFolder ? 'components' : 'first.py'}
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
