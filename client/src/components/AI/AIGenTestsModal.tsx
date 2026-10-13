import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import { Sparkles, X, Check, Code, FileCode, Copy, Save, ShieldAlert, TestTube2, BookOpen } from 'lucide-react';

interface AIGenTestsModalProps {
  selectedCode?: string;
  onClose: () => void;
}

export const AIGenTestsModal: React.FC<AIGenTestsModalProps> = ({ selectedCode, onClose }) => {
  const { activeWorkspace, activeFilePath, activeFileContent, createFileOrFolder } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [generatedTestCode, setGeneratedTestCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedFile, setSavedFile] = useState(false);
  const [testFramework, setTestFramework] = useState<string>('Auto-detect');

  const targetCode = selectedCode?.trim() || activeFileContent || '';

  const handleGenerateTests = async (frameworkToUse?: string) => {
    if (!activeWorkspace) return;
    setLoading(true);
    setExplanation('');
    setGeneratedTestCode('');
    try {
      const selectedFw = frameworkToUse || testFramework;
      const customPrompt = selectedFw !== 'Auto-detect' ? `Use ${selectedFw} testing framework` : '';

      const res = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType: 'test',
        userPrompt: customPrompt,
        activeFilePath,
        activeFileContent,
        selectedCode: targetCode
      });

      const responseText = res.data.response || '';
      setExplanation(responseText);

      // Extract final generated unit test code block
      const codeMatches = Array.from(responseText.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)) as RegExpExecArray[];
      if (codeMatches.length > 0) {
        const lastCodeBlock = codeMatches[codeMatches.length - 1][1].trim();
        setGeneratedTestCode(lastCodeBlock);
      }
    } catch (err) {
      console.error('AI Gen Tests Error:', err);
      setExplanation('Failed to generate unit tests. Please check your network and Gemini API key.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerateTests();
  }, []);

  const handleCopyCode = () => {
    if (generatedTestCode) {
      navigator.clipboard.writeText(generatedTestCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveAsTestFile = async () => {
    if (!activeFilePath || !generatedTestCode) return;

    // Construct test filename (e.g. math.ts -> math.test.ts or app.py -> test_app.py)
    let testFileName = 'test_suite.ts';
    if (activeFilePath.includes('.')) {
      const parts = activeFilePath.split('.');
      const ext = parts.pop();
      const baseName = parts.join('.');

      if (ext === 'py') {
        testFileName = `test_${baseName}.${ext}`;
      } else if (['js', 'ts', 'jsx', 'tsx'].includes(ext || '')) {
        testFileName = `${baseName}.test.${ext}`;
      } else {
        testFileName = `${baseName}_test.${ext}`;
      }
    }

    try {
      await createFileOrFolder(testFileName, false, generatedTestCode);
      setSavedFile(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      console.error('Failed to create test file:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '760px',
        maxWidth: '92vw',
        maxHeight: '88vh',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
            }}>
              <TestTube2 size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Gemini AI Unit Test Generator
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {selectedCode ? 'Generating test suite for selected code' : `Generating test suite for ${activeFilePath || 'active file'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Framework Selector Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Framework:</span>
          {['Auto-detect', 'Jest', 'Vitest', 'PyTest', 'GoogleTest'].map(fw => (
            <button
              key={fw}
              onClick={() => { setTestFramework(fw); handleGenerateTests(fw); }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: testFramework === fw ? '#ec4899' : 'transparent',
                color: testFramework === fw ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {fw}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-primary)' }}>
              <Sparkles size={36} className="animate-pulse" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                Gemini AI is designing unit test cases & assertion suites...
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Covering happy paths, boundary limits, and edge-case exceptions
              </span>
            </div>
          )}

          {explanation && !loading && (
            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', fontSize: '13px', lineHeight: '1.6', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: '#ec4899', marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} /> Test Suite Overview & Coverage Summary
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{explanation}</div>
            </div>
          )}

          {generatedTestCode && !loading && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--status-success)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--status-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCode size={15} /> Generated Unit Test Code
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copied ? <><Check size={12} color="#10b981" /> Copied!</> : <><Copy size={12} /> Copy Code</>}
                </button>
              </div>

              <pre style={{
                margin: 0,
                padding: '12px',
                fontFamily: "'Fira Code', Monaco, monospace",
                fontSize: '12px',
                maxHeight: '250px',
                overflowY: 'auto',
                color: 'var(--text-primary)',
                background: 'var(--bg-secondary)',
                lineHeight: '1.5'
              }}>
                {generatedTestCode}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <button onClick={() => handleGenerateTests()} className="btn-secondary" disabled={loading} style={{ fontSize: '12px' }}>
            <Sparkles size={14} /> Re-generate Suite
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn-secondary" style={{ fontSize: '12px' }}>Dismiss</button>
            {generatedTestCode && (
              <button
                onClick={handleSaveAsTestFile}
                className="btn-primary"
                disabled={savedFile}
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                {savedFile ? (
                  <>
                    <Check size={16} /> Created Test File in Project!
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save as New Test File
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
