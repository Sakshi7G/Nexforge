import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import api from '../../api/client';
import * as XLSX from 'xlsx';
import {
  Table, Plus, Search, Trash2, Edit2, Check, X, Download, Upload,
  Sparkles, Loader2, CheckCircle2, FileSpreadsheet, PlusCircle, MinusCircle,
  Copy, FileCode, Database
} from 'lucide-react';

interface SheetItem {
  id: string;
  workspaceId: string;
  title: string;
  dataJson: string; // JSON string of 2D array string[][]
  createdAt: string;
  updatedAt: string;
}

export const DataSheetsPanel: React.FC = () => {
  const { activeWorkspace } = useWorkspace();

  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [loading, setLoading] = useState(true);

  // Selected cell coordinates
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [formulaValue, setFormulaValue] = useState('');

  // AI Generator Modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  // Exporter dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  const saveTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSheet = sheets.find(s => s.id === activeSheetId) || null;

  // Parsed 2D grid matrix of the active sheet
  const getGridData = (): string[][] => {
    if (!activeSheet) return [];
    try {
      const parsed = JSON.parse(activeSheet.dataJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback
    }
    return [
      ['A', 'B', 'C'],
      ['1', '2', '3']
    ];
  };

  const gridData = getGridData();

  // 1. Fetch sheets list from backend
  const fetchSheets = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const res = await api.get(`/workspaces/${activeWorkspace.id}/sheets`);
      const fetchedSheets: SheetItem[] = res.data.sheets || [];
      setSheets(fetchedSheets);

      if (fetchedSheets.length > 0 && !activeSheetId) {
        setActiveSheetId(fetchedSheets[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch sheets:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // Keep formula bar in sync with selected cell
  useEffect(() => {
    if (selectedCell && gridData[selectedCell.row]) {
      const val = gridData[selectedCell.row][selectedCell.col] || '';
      setFormulaValue(val);
    }
  }, [selectedCell, activeSheetId]);

  // 2. Create new spreadsheet
  const handleCreateSheet = async () => {
    if (!activeWorkspace) return;
    try {
      const blankGrid = [
        ['', '', '', ''],
        ['', '', '', ''],
        ['', '', '', ''],
        ['', '', '', ''],
        ['', '', '', '']
      ];
      const res = await api.post(`/workspaces/${activeWorkspace.id}/sheets`, {
        title: `Data_Sheet_${sheets.length + 1}.xlsx`,
        dataJson: JSON.stringify(blankGrid)
      });
      const newSheet: SheetItem = res.data.sheet;
      setSheets(prev => [newSheet, ...prev]);
      setActiveSheetId(newSheet.id);
      setEditingTitleId(newSheet.id);
      setTempTitle(newSheet.title);
    } catch (err) {
      console.error('Failed to create spreadsheet:', err);
    }
  };

  // 3. Delete spreadsheet
  const handleDeleteSheet = async (sheetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}/sheets/${sheetId}`);
      setSheets(prev => prev.filter(s => s.id !== sheetId));
      if (activeSheetId === sheetId) {
        const remaining = sheets.filter(s => s.id !== sheetId);
        setActiveSheetId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete spreadsheet:', err);
    }
  };

  // 4. Save title
  const handleSaveTitle = async (sheetId: string) => {
    if (!activeWorkspace) return;
    const finalTitle = tempTitle.trim() || 'Untitled Sheet.xlsx';
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, title: finalTitle } : s));
    setEditingTitleId(null);
    try {
      await api.put(`/workspaces/${activeWorkspace.id}/sheets/${sheetId}`, { title: finalTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // 5. Save grid data mutation
  const updateGridState = (newGrid: string[][]) => {
    if (!activeSheetId || !activeWorkspace) return;
    setSaveStatus('saving');
    const jsonStr = JSON.stringify(newGrid);

    setSheets(prev => prev.map(s => s.id === activeSheetId ? { ...s, dataJson: jsonStr } : s));

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.put(`/workspaces/${activeWorkspace.id}/sheets/${activeSheetId}`, { dataJson: jsonStr });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 800);
  };

  // Cell edit handler
  const handleCellChange = (row: number, col: number, value: string) => {
    const newGrid = gridData.map((rArr, rIdx) => {
      if (rIdx !== row) return rArr;
      const copy = [...rArr];
      copy[col] = value;
      return copy;
    });
    updateGridState(newGrid);
  };

  // Grid Structure Alterations
  const handleAddRow = () => {
    if (gridData.length === 0) return;
    const colCount = gridData[0].length || 4;
    const newRow = new Array(colCount).fill('');
    updateGridState([...gridData, newRow]);
  };

  const handleAddColumn = () => {
    const newGrid = gridData.map(row => [...row, '']);
    updateGridState(newGrid);
  };

  const handleDeleteRow = () => {
    if (!selectedCell || gridData.length <= 1) return;
    const newGrid = gridData.filter((_, idx) => idx !== selectedCell.row);
    updateGridState(newGrid);
    setSelectedCell({ row: Math.max(0, selectedCell.row - 1), col: selectedCell.col });
  };

  const handleDeleteColumn = () => {
    if (!selectedCell || (gridData[0] && gridData[0].length <= 1)) return;
    const newGrid = gridData.map(row => row.filter((_, idx) => idx !== selectedCell.col));
    updateGridState(newGrid);
    setSelectedCell({ row: selectedCell.row, col: Math.max(0, selectedCell.col - 1) });
  };

  // Excel Column Label Converter (0 -> A, 1 -> B, 26 -> AA)
  const getColLabel = (index: number): string => {
    let label = '';
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode((i % 26) + 65) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  // Formula Evaluator (=SUM(A1:A5), =AVERAGE(B1:B10), =C2*D2)
  const evaluateCell = (cellValue: string, grid: string[][]): string => {
    if (!cellValue || !cellValue.startsWith('=')) return cellValue;

    try {
      const expr = cellValue.substring(1).trim().toUpperCase();

      // SUM formula (=SUM(E2:E4))
      const sumMatch = expr.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (sumMatch) {
        const startCol = sumMatch[1].charCodeAt(0) - 65;
        const startRow = parseInt(sumMatch[2], 10) - 1;
        const endCol = sumMatch[3].charCodeAt(0) - 65;
        const endRow = parseInt(sumMatch[4], 10) - 1;

        let total = 0;
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const val = parseFloat(grid[r]?.[c] || '0');
            if (!isNaN(val)) total += val;
          }
        }
        return total.toString();
      }

      // AVERAGE formula (=AVERAGE(A1:A5))
      const avgMatch = expr.match(/^AVERAGE\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (avgMatch) {
        const startCol = avgMatch[1].charCodeAt(0) - 65;
        const startRow = parseInt(avgMatch[2], 10) - 1;
        const endCol = avgMatch[3].charCodeAt(0) - 65;
        const endRow = parseInt(avgMatch[4], 10) - 1;

        let total = 0;
        let count = 0;
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const val = parseFloat(grid[r]?.[c] || '0');
            if (!isNaN(val)) {
              total += val;
              count++;
            }
          }
        }
        return count > 0 ? (total / count).toFixed(2) : '0';
      }

      // Simple arithmetic (=C2*D2 or =A1+B1)
      let replaced = expr;
      const refMatches = expr.match(/[A-Z]+\d+/g);
      if (refMatches) {
        for (const ref of refMatches) {
          const colLetter = ref.match(/[A-Z]+/)?.[0] || 'A';
          const rowNum = parseInt(ref.match(/\d+/)?.[0] || '1', 10) - 1;
          const colIdx = colLetter.charCodeAt(0) - 65;
          const val = parseFloat(grid[rowNum]?.[colIdx] || '0') || 0;
          replaced = replaced.replace(ref, val.toString());
        }
      }
      // Safe numeric eval
      const fn = new Function(`return ${replaced}`);
      const res = fn();
      return isNaN(res) ? '#ERROR!' : res.toString();
    } catch {
      return '#VALUE!';
    }
  };

  // Import CSV / XLSX File
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeWorkspace) return;

    const fileName = file.name;
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;

        let data: string[][] = [];

        // For XLSX/XLS or fallback, try SheetJS XLSX.read first
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          data = rawData.map(row => (Array.isArray(row) ? row.map(cell => String(cell ?? '')) : [String(row ?? '')]));
        } catch {
          // Fallback text parsing for standard CSV files
          const textDecoder = new TextDecoder('utf-8');
          const textContent = textDecoder.decode(buffer as ArrayBuffer);
          const lines = textContent.split(/\r?\n/).filter(line => line.trim() !== '');
          data = lines.map(line => {
            return line.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
          });
        }

        if (data.length === 0) {
          data = [['Col 1', 'Col 2'], ['', '']];
        }

        const res = await api.post(`/workspaces/${activeWorkspace.id}/sheets`, {
          title: fileName,
          dataJson: JSON.stringify(data)
        });

        const newSheet: SheetItem = res.data.sheet;
        setSheets(prev => [newSheet, ...prev]);
        setActiveSheetId(newSheet.id);

        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        console.error('File import error:', err);
        alert(`Failed to parse file: ${err.message || 'Invalid format'}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!activeSheet) return;
    const ws = XLSX.utils.aoa_to_sheet(gridData);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', activeSheet.title.replace(/\.[^/.]+$/, "") + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportXLSX = () => {
    if (!activeSheet) return;
    const ws = XLSX.utils.aoa_to_sheet(gridData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, activeSheet.title.endsWith('.xlsx') ? activeSheet.title : `${activeSheet.title}.xlsx`);
  };

  const handleExportJSON = () => {
    if (gridData.length < 2) return;
    const headers = gridData[0];
    const rows = gridData.slice(1);
    const jsonObjects = rows.map(r => {
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h || `col_${i}`] = r[i] || '';
      });
      return obj;
    });

    navigator.clipboard.writeText(JSON.stringify(jsonObjects, null, 2));
    alert('Exported Sheet data copied to clipboard as JSON Array!');
  };

  // Normalize any AI response into a 2D string matrix string[][]
  const normalizeAiTableResponse = (responseText: string): string[][] => {
    if (!responseText || !responseText.trim()) return [];

    // Strip markdown fences
    const cleanText = responseText
      .replace(/```(?:json|csv|text|markdown)?/gi, '')
      .replace(/```/g, '')
      .trim();

    // Strategy 1: Find all JSON objects { "key": "val", ... } in the text
    const objectMatches = cleanText.match(/\{[^{}]*\}/g);
    if (objectMatches && objectMatches.length > 0) {
      const validObjects: any[] = [];
      for (const objStr of objectMatches) {
        try {
          const parsedObj = JSON.parse(objStr);
          if (typeof parsedObj === 'object' && parsedObj !== null && !Array.isArray(parsedObj)) {
            if (Object.keys(parsedObj).length > 0) {
              validObjects.push(parsedObj);
            }
          }
        } catch {
          // Skip invalid JSON fragment
        }
      }

      if (validObjects.length > 0) {
        // Collect all unique keys for headers
        const headerSet = new Set<string>();
        validObjects.forEach(obj => {
          Object.keys(obj).forEach(k => headerSet.add(k));
        });
        const headers = Array.from(headerSet);

        const dataRows = validObjects.map(obj =>
          headers.map(h => String(obj[h] ?? ''))
        );

        return [headers, ...dataRows];
      }
    }

    // Strategy 2: Attempt full JSON 2D Array parse [["Header1","Header2"], ["Val1","Val2"]]
    const arrayMatch = cleanText.match(/\[\s*\[[\s\S]*\]\s*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
          return parsed.map((row: any) =>
            Array.isArray(row) ? row.map((cell: any) => String(cell ?? '')) : [String(row ?? '')]
          );
        }
      } catch {
        // Continue
      }
    }

    // Strategy 3: Try parsing Markdown Table (| Name | Role | Email | Status |)
    if (cleanText.includes('|')) {
      const lines = cleanText.split(/\r?\n/).filter((l: string) => l.includes('|'));
      const rows = lines
        .map((line: string) =>
          line
            .split('|')
            .map((cell: string) => cell.trim())
            .filter((cell: string, idx: number, arr: string[]) => {
              if ((idx === 0 || idx === arr.length - 1) && cell === '') return false;
              return true;
            })
        )
        .filter((row: string[]) => row.length > 0 && !row.every((cell: string) => /^:?-+:?$/.test(cell)));

      if (rows.length > 0) return rows;
    }

    // Strategy 4: CSV or TSV lines
    const lines = cleanText
      .split(/\r?\n/)
      .filter((l: string) => {
        const trimmed = l.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith('{') || trimmed.startsWith('}') || trimmed.startsWith('[') || trimmed.startsWith(']')) return false;
        if (trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith('-')) return false;
        if (/^(Persona|Task|Format|Constraint|Columns|Rows|User\s*\d+:|Note:)/i.test(trimmed)) return false;
        return true;
      });

    if (lines.length > 0) {
      return lines.map((line: string) => {
        const delimiter = line.includes('\t') ? '\t' : ',';
        return line.split(delimiter).map((c: string) => c.replace(/^["'{} ]|["'{} ]$/g, '').trim());
      });
    }

    return [];
  };

  // AI Mock Data Generator
  const handleGenerateAIData = async () => {
    if (!activeWorkspace || !aiPrompt.trim()) return;
    setGeneratingAi(true);
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/ai/prompt`, {
        promptType: 'generate_sheet',
        userPrompt: aiPrompt
      });

      const responseText = res.data.response || '';
      const parsedGrid = normalizeAiTableResponse(responseText);

      if (parsedGrid.length > 0) {
        updateGridState(parsedGrid);
        setShowAiModal(false);
        setAiPrompt('');
      } else {
        alert('Could not parse AI response into spreadsheet grid. Please try again with a specific prompt.');
      }
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      alert(`AI Generation failed: ${err.message || 'Error processing prompt'}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const filteredSheets = sheets.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Hidden File Input for CSV / XLSX Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
      />

      {/* LEFT PANE: Sheets Directory List */}
      <div style={{
        width: '280px',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        userSelect: 'none'
      }}>
        {/* Directory Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Data Sheets</span>
            <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '11px', padding: '2px 6px', borderRadius: '10px', fontWeight: '600' }}>
              {sheets.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import CSV or XLSX file"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <Upload size={14} />
            </button>

            <button
              onClick={handleCreateSheet}
              title="Create New Spreadsheet"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Plus size={14} /> New
            </button>
          </div>
        </div>

        {/* Search Bar */}
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
              placeholder="Search spreadsheets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', width: '100%' }}
            />
          </div>
        </div>

        {/* Sheets Master List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-secondary)', fontSize: '12px', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" /> Loading spreadsheets...
            </div>
          ) : filteredSheets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>
              <Table size={24} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p>No spreadsheets found.</p>
              <button onClick={handleCreateSheet} style={{ marginTop: '8px', background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', textDecoration: 'underline' }}>
                Create one now
              </button>
            </div>
          ) : (
            filteredSheets.map(s => {
              const isSelected = s.id === activeSheetId;
              const isEditingThisTitle = editingTitleId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSheetId(s.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    border: isSelected ? '1px solid #10b981' : '1px solid transparent',
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
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(s.id); }}
                          autoFocus
                          style={{
                            flex: 1,
                            background: 'var(--bg-primary)',
                            border: '1px solid #10b981',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            padding: '2px 6px',
                            outline: 'none'
                          }}
                        />
                        <button onClick={() => handleSaveTitle(s.id)} style={{ border: 'none', background: 'transparent', color: '#10b981', cursor: 'pointer' }}>
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: isSelected ? '700' : '600', fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {s.title}
                      </span>
                    )}

                    {!isEditingThisTitle && isSelected && (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingTitleId(s.id);
                            setTempTitle(s.title);
                          }}
                          title="Rename Sheet"
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={e => handleDeleteSheet(s.id, e)}
                          title="Delete Sheet"
                          style={{ border: 'none', background: 'transparent', color: 'var(--status-error)', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Spreadsheet • {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: Spreadsheet Grid Studio */}
      {activeSheet ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
          
          {/* Studio Action Toolbar */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)'
          }}>
            {/* Sheet Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={20} style={{ color: '#10b981' }} />
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {activeSheet.title}
              </h2>
            </div>

            {/* Grid Controls & Exporters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              
              {/* Row & Column Actions */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                <button onClick={handleAddRow} title="Add Row below" style={{ padding: '4px 8px', borderRadius: '4px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PlusCircle size={12} style={{ color: '#10b981' }} /> + Row
                </button>
                <button onClick={handleAddColumn} title="Add Column right" style={{ padding: '4px 8px', borderRadius: '4px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PlusCircle size={12} style={{ color: '#10b981' }} /> + Col
                </button>
                <button onClick={handleDeleteRow} title="Delete selected row" style={{ padding: '4px 8px', borderRadius: '4px', background: 'transparent', border: 'none', color: 'var(--status-error)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MinusCircle size={12} /> - Row
                </button>
                <button onClick={handleDeleteColumn} title="Delete selected column" style={{ padding: '4px 8px', borderRadius: '4px', background: 'transparent', border: 'none', color: 'var(--status-error)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MinusCircle size={12} /> - Col
                </button>
              </div>

              {/* AI Mock Data Generator Button */}
              <button
                onClick={() => setShowAiModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={12} /> AI Generate Data
              </button>

              {/* Export Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Download size={12} /> Export ▾
                </button>

                {showExportMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    minWidth: '160px',
                    overflow: 'hidden'
                  }}>
                    <button onClick={() => { handleExportCSV(); setShowExportMenu(false); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileSpreadsheet size={13} style={{ color: '#10b981' }} /> Export as CSV (.csv)
                    </button>
                    <button onClick={() => { handleExportXLSX(); setShowExportMenu(false); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileSpreadsheet size={13} style={{ color: '#10b981' }} /> Export as Excel (.xlsx)
                    </button>
                    <button onClick={() => { handleExportJSON(); setShowExportMenu(false); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileCode size={13} style={{ color: '#6366f1' }} /> Copy JSON Array
                    </button>
                  </div>
                )}
              </div>

              {/* Save Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 size={13} className="animate-spin" style={{ color: '#10b981' }} /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} style={{ color: '#10b981' }} /> Saved
                  </>
                )}
              </div>

            </div>
          </div>

          {/* Formula Bar */}
          <div style={{
            padding: '6px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#10b981',
              background: 'var(--bg-primary)',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              {selectedCell ? `${getColLabel(selectedCell.col)}${selectedCell.row + 1}` : 'A1'}
            </div>

            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>ƒx</div>

            <input
              type="text"
              value={formulaValue}
              onChange={e => {
                setFormulaValue(e.target.value);
                if (selectedCell) {
                  handleCellChange(selectedCell.row, selectedCell.col, e.target.value);
                }
              }}
              placeholder="Enter value or formula (e.g. =SUM(A1:A5), =C2*D2)..."
              style={{
                flex: 1,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '4px 10px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: "'Fira Code', Monaco, monospace",
                outline: 'none'
              }}
            />
          </div>

          {/* Excel Grid Surface */}
          <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', borderSpacing: 0, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', padding: '4px', textAlign: 'center' }}>#</th>
                  {gridData[0]?.map((_, colIdx) => (
                    <th key={colIdx} style={{ width: '140px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', padding: '6px', textAlign: 'center' }}>
                      {getColLabel(colIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridData.map((rowArr, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', fontWeight: '600' }}>
                      {rIdx + 1}
                    </td>
                    {rowArr.map((cellRaw, cIdx) => {
                      const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                      const isEditing = editingCell?.row === rIdx && editingCell?.col === cIdx;
                      const isHeaderRow = rIdx === 0;

                      const computedDisplay = evaluateCell(cellRaw, gridData);

                      return (
                        <td
                          key={cIdx}
                          onClick={() => {
                            setSelectedCell({ row: rIdx, col: cIdx });
                            setFormulaValue(cellRaw);
                          }}
                          onDoubleClick={() => {
                            setEditingCell({ row: rIdx, col: cIdx });
                          }}
                          style={{
                            border: isSelected ? '2px solid #10b981' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(16, 185, 129, 0.08)' : isHeaderRow ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                            padding: '0',
                            height: '28px',
                            position: 'relative',
                            userSelect: 'none'
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={cellRaw}
                              onChange={e => handleCellChange(rIdx, cIdx, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              style={{
                                width: '100%',
                                height: '100%',
                                background: 'var(--bg-primary)',
                                border: 'none',
                                outline: 'none',
                                padding: '4px 8px',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontFamily: isHeaderRow ? 'inherit' : "'Fira Code', monospace"
                              }}
                            />
                          ) : (
                            <div style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: isHeaderRow ? '700' : '400',
                              color: cellRaw.startsWith('=') ? '#10b981' : 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {computedDisplay}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Grid Summary Bar */}
          <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Rows: {gridData.length} | Cols: {gridData[0]?.length || 0}</span>
            <span>Excel Formula Support: =SUM(), =AVERAGE(), Arithmetic (+ - * /)</span>
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <FileSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>No Spreadsheet Selected</h3>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>Select a spreadsheet from the left sidebar or create a new one.</p>
          <button
            onClick={handleCreateSheet}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Create New Spreadsheet
          </button>
        </div>
      )}

      {/* AI Data Generator Modal */}
      {showAiModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '440px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={18} style={{ color: '#10b981' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Gemini AI Spreadsheet Generator</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Describe the data table you want to generate (e.g. "Generate 5 rows of employee names, emails, departments, and salaries")</p>
            
            <textarea
              rows={3}
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. Generate 6 mock users with Name, Role, API Key Status, and Monthly Usage Limit..."
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                resize: 'none',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowAiModal(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleGenerateAIData} disabled={generatingAi || !aiPrompt.trim()} className="btn-primary" style={{ background: '#10b981', padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {generatingAi ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Generate & Populate Sheet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
