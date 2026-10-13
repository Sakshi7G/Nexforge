import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSocket } from '../../api/socket';
import {
  MousePointer, Hand, Edit3, Highlighter, Square, Circle,
  Diamond, Database, Minus, ArrowRight, StickyNote, Type,
  Eraser, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Grid,
  Download, Copy, Trash2, Sparkles
} from 'lucide-react';

export type ToolType =
  | 'select'
  | 'hand'
  | 'pen'
  | 'highlighter'
  | 'rect'
  | 'roundedRect'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'line'
  | 'arrow'
  | 'sticky'
  | 'text'
  | 'eraser';

export type FillStyle = 'none' | 'tint' | 'solid';
export type StrokeStyle = 'solid' | 'dashed';
export type GridType = 'dots' | 'grid' | 'none';

export interface Point {
  x: number;
  y: number;
}

export interface WhiteboardElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: Point[];
  color: string;
  fillStyle?: FillStyle;
  lineWidth: number;
  strokeStyle?: StrokeStyle;
  text?: string;
  fontSize?: number;
  stickyColor?: string;
}

export interface PeerCursor {
  socketId: string;
  x: number;
  y: number;
  userName: string;
  userColor: string;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#94a3b8', // Slate
  '#1e293b', // Deep Navy / Charcoal
  '#000000', // Black
  '#ffffff'  // Pure White
];

const STICKY_COLORS = [
  { name: 'Yellow', bg: '#fef08a', border: '#eab308' },
  { name: 'Cyan', bg: '#bae6fd', border: '#38bdf8' },
  { name: 'Mint', bg: '#bbf7d0', border: '#4ade80' },
  { name: 'Lavender', bg: '#e9d5ff', border: '#c084fc' },
  { name: 'Coral', bg: '#fecdd3', border: '#fb7185' }
];

export const WhiteboardCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const socket = getSocket();

  // Elements & Selection State
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  // Active Tool & Style State
  const [tool, setTool] = useState<ToolType>('select');
  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(3);
  const [fillStyle, setFillStyle] = useState<FillStyle>('tint');
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [stickyColor, setStickyColor] = useState('#fef08a');
  const [fontSize, setFontSize] = useState(16);

  // Viewport State (Infinite Canvas)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [gridType, setGridType] = useState<GridType>('dots');
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [startWorldPos, setStartWorldPos] = useState<Point | null>(null);
  const [startScreenPos, setStartScreenPos] = useState<Point | null>(null);
  const [currentDraft, setCurrentDraft] = useState<WhiteboardElement | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);

  // Peer Cursors
  const [peerCursors, setPeerCursors] = useState<{ [socketId: string]: PeerCursor }>({});

  // Inline Text Editor
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
    isSticky?: boolean;
    w?: number;
    h?: number;
  } | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Convert screen coordinates to world coordinates
  const toWorld = useCallback((screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom
    };
  }, [pan, zoom]);

  // Convert world coordinates to screen coordinates
  const toScreen = useCallback((worldX: number, worldY: number): Point => {
    return {
      x: worldX * zoom + pan.x,
      y: worldY * zoom + pan.y
    };
  }, [pan, zoom]);

  // History Helper
  const commitChange = useCallback((newElements: WhiteboardElement[]) => {
    setHistory(prev => [...prev.slice(-30), elements]);
    setRedoStack([]);
    setElements(newElements);
    if (activeWorkspace) {
      socket.emit('whiteboard:save', { workspaceId: activeWorkspace.id, dataJson: newElements });
    }
  }, [elements, activeWorkspace, socket]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, elements]);
    setElements(previous);
    if (activeWorkspace) {
      socket.emit('whiteboard:save', { workspaceId: activeWorkspace.id, dataJson: previous });
    }
  }, [history, elements, activeWorkspace, socket]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setHistory(prev => [...prev, elements]);
    setElements(next);
    if (activeWorkspace) {
      socket.emit('whiteboard:save', { workspaceId: activeWorkspace.id, dataJson: next });
    }
  }, [redoStack, elements, activeWorkspace, socket]);

  // WebSocket Listeners
  useEffect(() => {
    if (!activeWorkspace) return;

    socket.emit('whiteboard:join', { workspaceId: activeWorkspace.id });

    const handleState = (savedElements: WhiteboardElement[]) => {
      setElements(savedElements || []);
    };

    const handleDraw = (element: WhiteboardElement) => {
      setElements(prev => {
        const filtered = prev.filter(el => el.id !== element.id);
        return [...filtered, element];
      });
    };

    const handleClear = () => {
      setElements([]);
      setSelectedId(null);
    };

    const handleCursor = (cursor: PeerCursor) => {
      setPeerCursors(prev => ({ ...prev, [cursor.socketId]: cursor }));
    };

    const handleCursorLeave = ({ socketId }: { socketId: string }) => {
      setPeerCursors(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on('whiteboard:state', handleState);
    socket.on('whiteboard:draw', handleDraw);
    socket.on('whiteboard:clear', handleClear);
    socket.on('whiteboard:cursor', handleCursor);
    socket.on('whiteboard:cursor:leave', handleCursorLeave);

    return () => {
      socket.off('whiteboard:state', handleState);
      socket.off('whiteboard:draw', handleDraw);
      socket.off('whiteboard:clear', handleClear);
      socket.off('whiteboard:cursor', handleCursor);
      socket.off('whiteboard:cursor:leave', handleCursorLeave);
      socket.emit('whiteboard:cursor:leave', { workspaceId: activeWorkspace.id });
    };
  }, [activeWorkspace, socket]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingText) return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        commitChange(elements.filter(el => el.id !== selectedId));
        setSelectedId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedId) {
        e.preventDefault();
        const target = elements.find(el => el.id === selectedId);
        if (target) {
          const duplicate: WhiteboardElement = {
            ...target,
            id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            x: target.x + 25,
            y: target.y + 25,
            x1: target.x1 !== undefined ? target.x1 + 25 : undefined,
            y1: target.y1 !== undefined ? target.y1 + 25 : undefined,
            x2: target.x2 !== undefined ? target.x2 + 25 : undefined,
            y2: target.y2 !== undefined ? target.y2 + 25 : undefined,
            points: target.points ? target.points.map(p => ({ x: p.x + 25, y: p.y + 25 })) : undefined
          };
          commitChange([...elements, duplicate]);
          setSelectedId(duplicate.id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingText, handleUndo, handleRedo, selectedId, elements, commitChange]);

  // Canvas Drawing & Rendering Routine
  const drawElement = (ctx: CanvasRenderingContext2D, el: WhiteboardElement, isSelected = false) => {
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(el.strokeStyle === 'dashed' ? [8, 6] : []);

    const getFillColor = (baseColor: string, style?: FillStyle) => {
      if (style === 'solid') return baseColor;
      if (style === 'tint') {
        if (baseColor.startsWith('#') && baseColor.length === 7) {
          const r = parseInt(baseColor.slice(1, 3), 16);
          const g = parseInt(baseColor.slice(3, 5), 16);
          const b = parseInt(baseColor.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, 0.18)`;
        }
        return 'rgba(99, 102, 241, 0.18)';
      }
      return 'transparent';
    };

    switch (el.type) {
      case 'pen': {
        if (el.points && el.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            const p1 = el.points[i - 1];
            const p2 = el.points[i];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
          }
          ctx.stroke();
        }
        break;
      }

      case 'highlighter': {
        if (el.points && el.points.length > 0) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = el.lineWidth * 2.8;
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          el.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case 'rect': {
        const w = el.w || 0;
        const h = el.h || 0;
        if (el.fillStyle && el.fillStyle !== 'none') {
          ctx.fillStyle = getFillColor(el.color, el.fillStyle);
          ctx.fillRect(el.x, el.y, w, h);
        }
        ctx.strokeRect(el.x, el.y, w, h);
        break;
      }

      case 'roundedRect': {
        const w = el.w || 0;
        const h = el.h || 0;
        const r = Math.min(16, Math.abs(w) / 4, Math.abs(h) / 4);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(el.x, el.y, w, h, r);
        } else {
          ctx.rect(el.x, el.y, w, h);
        }
        if (el.fillStyle && el.fillStyle !== 'none') {
          ctx.fillStyle = getFillColor(el.color, el.fillStyle);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }

      case 'circle': {
        const w = el.w || 0;
        const h = el.h || 0;
        const cx = el.x + w / 2;
        const cy = el.y + h / 2;
        const rx = Math.abs(w / 2);
        const ry = Math.abs(h / 2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
        if (el.fillStyle && el.fillStyle !== 'none') {
          ctx.fillStyle = getFillColor(el.color, el.fillStyle);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }

      case 'diamond': {
        const w = el.w || 0;
        const h = el.h || 0;
        const cx = el.x + w / 2;
        const cy = el.y + h / 2;
        ctx.beginPath();
        ctx.moveTo(cx, el.y);
        ctx.lineTo(el.x + w, cy);
        ctx.lineTo(cx, el.y + h);
        ctx.lineTo(el.x, cy);
        ctx.closePath();
        if (el.fillStyle && el.fillStyle !== 'none') {
          ctx.fillStyle = getFillColor(el.color, el.fillStyle);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }

      case 'cylinder': {
        const w = el.w || 0;
        const h = el.h || 0;
        const rx = Math.abs(w / 2);
        const ry = Math.max(8, Math.min(20, Math.abs(h) / 5));
        const cx = el.x + w / 2;

        ctx.beginPath();
        ctx.ellipse(cx, el.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.moveTo(el.x, el.y + ry);
        ctx.lineTo(el.x, el.y + h - ry);
        ctx.ellipse(cx, el.y + h - ry, rx, ry, 0, 0, Math.PI);
        ctx.lineTo(el.x + w, el.y + ry);

        if (el.fillStyle && el.fillStyle !== 'none') {
          ctx.fillStyle = getFillColor(el.color, el.fillStyle);
          ctx.fill();
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(cx, el.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'line': {
        if (el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
          ctx.beginPath();
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(el.x2, el.y2);
          ctx.stroke();
        }
        break;
      }

      case 'arrow': {
        if (el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
          const dx = el.x2 - el.x1;
          const dy = el.y2 - el.y1;
          const angle = Math.atan2(dy, dx);
          const headLen = Math.max(12, el.lineWidth * 3.5);

          ctx.beginPath();
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(el.x2, el.y2);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(el.x2 - headLen * Math.cos(angle - Math.PI / 6), el.y2 - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(el.x2 - headLen * Math.cos(angle + Math.PI / 6), el.y2 - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = el.color;
          ctx.fill();
        }
        break;
      }

      case 'sticky': {
        const w = el.w || 160;
        const h = el.h || 140;
        const sColor = el.stickyColor || '#fef08a';

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        ctx.fillStyle = sColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(el.x, el.y, w, h, 8);
        else ctx.rect(el.x, el.y, w, h);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (el.text) {
          ctx.fillStyle = '#0f172a';
          ctx.font = '600 13px Inter, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const lines = el.text.split('\n');
          let textY = el.y + 14;
          lines.forEach(line => {
            ctx.fillText(line, el.x + 14, textY, w - 28);
            textY += 18;
          });
        }
        break;
      }

      case 'text': {
        if (el.text) {
          ctx.fillStyle = el.color;
          ctx.font = `600 ${el.fontSize || 16}px Inter, -apple-system, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const lines = el.text.split('\n');
          let curY = el.y;
          lines.forEach(l => {
            ctx.fillText(l, el.x, curY);
            curY += (el.fontSize || 16) * 1.35;
          });
        }
        break;
      }
    }

    if (isSelected) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;

      const bounds = getElementBounds(el);
      const pad = 6;
      ctx.strokeRect(bounds.minX - pad, bounds.minY - pad, (bounds.maxX - bounds.minX) + pad * 2, (bounds.maxY - bounds.minY) + pad * 2);

      ctx.setLineDash([]);
      ctx.fillStyle = '#6366f1';
      const corners = [
        { x: bounds.minX - pad, y: bounds.minY - pad },
        { x: bounds.maxX + pad, y: bounds.minY - pad },
        { x: bounds.minX - pad, y: bounds.maxY + pad },
        { x: bounds.maxX + pad, y: bounds.maxY + pad }
      ];
      corners.forEach(c => {
        ctx.fillRect(c.x - 3.5, c.y - 3.5, 7, 7);
      });
    }

    ctx.restore();
  };

  const getElementBounds = (el: WhiteboardElement) => {
    if (el.type === 'pen' || el.type === 'highlighter') {
      if (!el.points || el.points.length === 0) return { minX: el.x, minY: el.y, maxX: el.x, maxY: el.y };
      const xs = el.points.map(p => p.x);
      const ys = el.points.map(p => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      };
    }
    if (el.type === 'line' || el.type === 'arrow') {
      const x1 = el.x1 ?? el.x;
      const y1 = el.y1 ?? el.y;
      const x2 = el.x2 ?? el.x;
      const y2 = el.y2 ?? el.y;
      return {
        minX: Math.min(x1, x2),
        minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2),
        maxY: Math.max(y1, y2)
      };
    }
    const w = el.w || 100;
    const h = el.h || 60;
    return {
      minX: Math.min(el.x, el.x + w),
      minY: Math.min(el.y, el.y + h),
      maxX: Math.max(el.x, el.x + w),
      maxY: Math.max(el.y, el.y + h)
    };
  };

  const hitTest = (el: WhiteboardElement, point: Point): boolean => {
    const bounds = getElementBounds(el);
    const pad = 10;
    return (
      point.x >= bounds.minX - pad &&
      point.x <= bounds.maxX + pad &&
      point.y >= bounds.minY - pad &&
      point.y <= bounds.maxY + pad
    );
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Dynamic Theme Canvas Background
    const canvasBg = isDark ? '#0a0d14' : '#f8fafc';
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Pattern with Theme Adaptation
    if (gridType === 'dots') {
      const step = 28 * zoom;
      const startX = ((pan.x % step) + step) % step;
      const startY = ((pan.y % step) + step) % step;
      ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.15)';
      for (let x = startX; x < width; x += step) {
        for (let y = startY; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (gridType === 'grid') {
      const step = 36 * zoom;
      const startX = ((pan.x % step) + step) % step;
      const startY = ((pan.y % step) + step) % step;
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    elements.forEach(el => {
      drawElement(ctx, el, el.id === selectedId);
    });

    if (currentDraft) {
      drawElement(ctx, currentDraft, false);
    }

    Object.values(peerCursors).forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);

      ctx.fillStyle = c.userColor || '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(4, 11);
      ctx.lineTo(9, 11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.font = '700 10px Inter, sans-serif';
      const nameWidth = ctx.measureText(c.userName).width;
      ctx.fillStyle = c.userColor || '#06b6d4';
      if (ctx.roundRect) ctx.roundRect(12, 4, nameWidth + 10, 16, 4);
      else ctx.fillRect(12, 4, nameWidth + 10, 16);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.userName, 17, 16);
      ctx.restore();
    });

    ctx.restore();
    ctx.restore();
  }, [elements, currentDraft, selectedId, pan, zoom, gridType, peerCursors, isDark]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editingText) return;

    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = toWorld(e.clientX, e.clientY);
    setStartScreenPos(screenPos);
    setStartWorldPos(worldPos);
    setIsDrawing(true);

    if (isSpacePressed || tool === 'hand' || e.button === 1) {
      return;
    }

    if (tool === 'select') {
      const hit = [...elements].reverse().find(el => hitTest(el, worldPos));
      if (hit) {
        setSelectedId(hit.id);
        setDragOffset({ x: worldPos.x - hit.x, y: worldPos.y - hit.y });
      } else {
        setSelectedId(null);
        setDragOffset(null);
      }
      return;
    }

    if (tool === 'eraser') {
      const hitIndex = elements.findIndex(el => hitTest(el, worldPos));
      if (hitIndex !== -1) {
        const next = [...elements];
        next.splice(hitIndex, 1);
        commitChange(next);
      }
      return;
    }

    if (tool === 'text') {
      const newId = `text_${Date.now()}`;
      setEditingText({
        id: newId,
        x: worldPos.x,
        y: worldPos.y,
        text: '',
        isSticky: false
      });
      setIsDrawing(false);
      return;
    }

    if (tool === 'sticky') {
      const newId = `sticky_${Date.now()}`;
      const newSticky: WhiteboardElement = {
        id: newId,
        type: 'sticky',
        x: worldPos.x - 80,
        y: worldPos.y - 70,
        w: 160,
        h: 140,
        color: '#1e293b',
        stickyColor,
        lineWidth: 1,
        text: 'Type a thought or architecture note...'
      };
      commitChange([...elements, newSticky]);
      setSelectedId(newId);
      setEditingText({
        id: newId,
        x: newSticky.x,
        y: newSticky.y,
        text: newSticky.text || '',
        isSticky: true,
        w: 160,
        h: 140
      });
      setIsDrawing(false);
      return;
    }

    const newId = `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (tool === 'pen' || tool === 'highlighter') {
      const newEl: WhiteboardElement = {
        id: newId,
        type: tool,
        x: worldPos.x,
        y: worldPos.y,
        color,
        lineWidth,
        points: [worldPos]
      };
      setCurrentDraft(newEl);
    } else if (tool === 'line' || tool === 'arrow') {
      const newEl: WhiteboardElement = {
        id: newId,
        type: tool,
        x: worldPos.x,
        y: worldPos.y,
        x1: worldPos.x,
        y1: worldPos.y,
        x2: worldPos.x,
        y2: worldPos.y,
        color,
        lineWidth,
        strokeStyle
      };
      setCurrentDraft(newEl);
    } else {
      const newEl: WhiteboardElement = {
        id: newId,
        type: tool,
        x: worldPos.x,
        y: worldPos.y,
        w: 0,
        h: 0,
        color,
        lineWidth,
        fillStyle,
        strokeStyle
      };
      setCurrentDraft(newEl);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = toWorld(e.clientX, e.clientY);

    if (activeWorkspace && user) {
      socket.emit('whiteboard:cursor', {
        workspaceId: activeWorkspace.id,
        cursor: {
          x: worldPos.x,
          y: worldPos.y,
          userName: user.name,
          userColor: '#6366f1'
        }
      });
    }

    if (!isDrawing) return;

    if (isSpacePressed || tool === 'hand' || e.buttons === 4) {
      if (startScreenPos) {
        const dx = e.clientX - startScreenPos.x;
        const dy = e.clientY - startScreenPos.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setStartScreenPos({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (tool === 'select' && selectedId && dragOffset) {
      setElements(prev =>
        prev.map(el => {
          if (el.id !== selectedId) return el;
          const dx = worldPos.x - dragOffset.x - el.x;
          const dy = worldPos.y - dragOffset.y - el.y;

          if (el.points) {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
              points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          }
          if (el.x1 !== undefined && el.y1 !== undefined) {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
              x1: el.x1 + dx,
              y1: el.y1 + dy,
              x2: el.x2 !== undefined ? el.x2 + dx : undefined,
              y2: el.y2 !== undefined ? el.y2 + dy : undefined
            };
          }
          return { ...el, x: el.x + dx, y: el.y + dy };
        })
      );
      return;
    }

    if (tool === 'eraser') {
      const hitIndex = elements.findIndex(el => hitTest(el, worldPos));
      if (hitIndex !== -1) {
        const next = [...elements];
        next.splice(hitIndex, 1);
        commitChange(next);
      }
      return;
    }

    if (currentDraft && startWorldPos) {
      if (currentDraft.type === 'pen' || currentDraft.type === 'highlighter') {
        setCurrentDraft(prev => {
          if (!prev || !prev.points) return prev;
          return { ...prev, points: [...prev.points, worldPos] };
        });
      } else if (currentDraft.type === 'line' || currentDraft.type === 'arrow') {
        setCurrentDraft(prev => {
          if (!prev) return prev;
          return { ...prev, x2: worldPos.x, y2: worldPos.y };
        });
      } else {
        const w = worldPos.x - startWorldPos.x;
        const h = worldPos.y - startWorldPos.y;
        setCurrentDraft(prev => {
          if (!prev) return prev;
          return { ...prev, w, h };
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setStartScreenPos(null);
    setStartWorldPos(null);
    setDragOffset(null);

    if (currentDraft) {
      let finalElement = { ...currentDraft };
      if (finalElement.w !== undefined && finalElement.h !== undefined && (finalElement.type === 'rect' || finalElement.type === 'roundedRect' || finalElement.type === 'circle' || finalElement.type === 'diamond' || finalElement.type === 'cylinder')) {
        let x = finalElement.x;
        let y = finalElement.y;
        let w = finalElement.w;
        let h = finalElement.h;

        if (w < 0) {
          x += w;
          w = Math.abs(w);
        }
        if (h < 0) {
          y += h;
          h = Math.abs(h);
        }
        finalElement = { ...finalElement, x, y, w: Math.max(w, 4), h: Math.max(h, 4) };
      }

      commitChange([...elements, finalElement]);
      setCurrentDraft(null);
      if (activeWorkspace) {
        socket.emit('whiteboard:draw', { workspaceId: activeWorkspace.id, stroke: finalElement });
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = toWorld(e.clientX, e.clientY);
    const hit = [...elements].reverse().find(el => hitTest(el, worldPos));
    if (hit && (hit.type === 'text' || hit.type === 'sticky')) {
      setSelectedId(hit.id);
      setEditingText({
        id: hit.id,
        x: hit.x,
        y: hit.y,
        text: hit.text || '',
        isSticky: hit.type === 'sticky',
        w: hit.w,
        h: hit.h
      });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(prev => Math.min(3.0, Math.max(0.2, prev * zoomFactor)));
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const commitEditingText = () => {
    if (!editingText) return;
    if (editingText.isSticky) {
      const next = elements.map(el => (el.id === editingText.id ? { ...el, text: editingText.text } : el));
      commitChange(next);
    } else {
      if (editingText.text.trim()) {
        const existing = elements.find(el => el.id === editingText.id);
        if (existing) {
          commitChange(elements.map(el => (el.id === editingText.id ? { ...el, text: editingText.text } : el)));
        } else {
          const newTextEl: WhiteboardElement = {
            id: editingText.id,
            type: 'text',
            x: editingText.x,
            y: editingText.y,
            color,
            fontSize,
            lineWidth: 1,
            text: editingText.text
          };
          commitChange([...elements, newTextEl]);
        }
      } else {
        commitChange(elements.filter(el => el.id !== editingText.id));
      }
    }
    setEditingText(null);
  };

  const handleClearAll = () => {
    if (!activeWorkspace) return;
    if (elements.length === 0) return;
    if (window.confirm('Are you sure you want to clear the entire whiteboard?')) {
      commitChange([]);
      setSelectedId(null);
      socket.emit('whiteboard:clear', { workspaceId: activeWorkspace.id });
      showToast('Whiteboard cleared');
    }
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas || elements.length === 0) {
      showToast('Nothing to export yet!');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `nexforge-whiteboard-${activeWorkspace?.name || 'diagram'}.png`;
    a.click();
    showToast('Exported diagram as PNG!');
  };

  const handleCopyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(blob => {
      if (blob && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(() => showToast('Diagram copied to clipboard!'))
          .catch(() => showToast('Failed to copy image to clipboard.'));
      }
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#0a0d14' : '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          color: isDark ? '#ffffff' : '#0f172a',
          padding: '8px 18px',
          borderRadius: '30px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Sparkles size={14} style={{ color: '#06b6d4' }} /> {toastMessage}
        </div>
      )}

      {/* Floating Top Primary Glassmorphism Toolbar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderRadius: '14px',
        padding: '6px 10px',
        boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.1)'
      }}>
        {/* Navigation & Select Tools */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {[
            { id: 'select', icon: MousePointer, label: 'Select & Move (V)' },
            { id: 'hand', icon: Hand, label: 'Pan Canvas (Space)' }
          ].map(t => {
            const Icon = t.icon;
            const isActive = tool === t.id && !isSpacePressed;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id as ToolType)}
                title={t.label}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent-primary, #6366f1)' : 'transparent',
                  color: isActive ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '22px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

        {/* Freehand Brushes */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {[
            { id: 'pen', icon: Edit3, label: 'Smooth Pen (P)' },
            { id: 'highlighter', icon: Highlighter, label: 'Highlighter (H)' }
          ].map(t => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id as ToolType)}
                title={t.label}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent-primary, #6366f1)' : 'transparent',
                  color: isActive ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '22px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

        {/* Shapes & Connectors */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {[
            { id: 'rect', icon: Square, label: 'Rectangle (R)' },
            { id: 'circle', icon: Circle, label: 'Circle / Node (C)' },
            { id: 'diamond', icon: Diamond, label: 'Decision Node (D)' },
            { id: 'cylinder', icon: Database, label: 'Database Storage' },
            { id: 'arrow', icon: ArrowRight, label: 'Connector Arrow (A)' },
            { id: 'line', icon: Minus, label: 'Line (L)' }
          ].map(t => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id as ToolType)}
                title={t.label}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent-primary, #6366f1)' : 'transparent',
                  color: isActive ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '22px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

        {/* Text & Sticky Notes */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {[
            { id: 'sticky', icon: StickyNote, label: 'Sticky Note (S)' },
            { id: 'text', icon: Type, label: 'Text Label (T)' },
            { id: 'eraser', icon: Eraser, label: 'Object Eraser (E)' }
          ].map(t => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id as ToolType)}
                title={t.label}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent-primary, #6366f1)' : 'transparent',
                  color: isActive ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '22px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 2px' }} />

        {/* Undo / Redo */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo (Ctrl+Z)"
            style={{
              width: '32px',
              height: '34px',
              background: 'transparent',
              border: 'none',
              color: history.length > 0 ? (isDark ? 'var(--text-primary)' : '#0f172a') : 'var(--text-muted)',
              cursor: history.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            style={{
              width: '32px',
              height: '34px',
              background: 'transparent',
              border: 'none',
              color: redoStack.length > 0 ? (isDark ? 'var(--text-primary)' : '#0f172a') : 'var(--text-muted)',
              cursor: redoStack.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>

      {/* Floating Left Properties / Styling Toolbar */}
      <div style={{
        position: 'absolute',
        top: '74px',
        left: '20px',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
        width: '180px'
      }}>
        {/* Stroke / Shape Color */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'var(--text-muted)' : '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
            Color
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {PALETTE.map(c => (
              <div
                key={c}
                onClick={() => {
                  setColor(c);
                  if (selectedId) {
                    commitChange(elements.map(el => el.id === selectedId ? { ...el, color: c } : el));
                  }
                }}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  background: c,
                  cursor: 'pointer',
                  border: color === c ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.2)',
                  boxShadow: color === c ? '0 0 8px rgba(99,102,241,0.6)' : 'none',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.1s ease'
                }}
              />
            ))}
          </div>
        </div>

        {/* Sticky Note Colors (when Sticky is active or selected) */}
        {(tool === 'sticky' || elements.find(el => el.id === selectedId)?.type === 'sticky') && (
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'var(--text-muted)' : '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Sticky Color
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {STICKY_COLORS.map(sc => (
                <div
                  key={sc.bg}
                  onClick={() => {
                    setStickyColor(sc.bg);
                    if (selectedId) {
                      commitChange(elements.map(el => el.id === selectedId ? { ...el, stickyColor: sc.bg } : el));
                    }
                  }}
                  title={sc.name}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: sc.bg,
                    border: stickyColor === sc.bg ? `2px solid ${sc.border}` : '1px solid rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    transform: stickyColor === sc.bg ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.1s'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stroke Width Selector */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'var(--text-muted)' : '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
            Thickness
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { val: 2, label: 'Thin' },
              { val: 4, label: 'Med' },
              { val: 8, label: 'Bold' },
              { val: 14, label: 'Heavy' }
            ].map(w => (
              <button
                key={w.val}
                onClick={() => {
                  setLineWidth(w.val);
                  if (selectedId) {
                    commitChange(elements.map(el => el.id === selectedId ? { ...el, lineWidth: w.val } : el));
                  }
                }}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: '6px',
                  background: lineWidth === w.val ? 'var(--accent-primary, #6366f1)' : (isDark ? 'var(--bg-secondary)' : '#f1f5f9'),
                  color: lineWidth === w.val ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                  border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
                  fontSize: '10px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fill Style */}
        {['rect', 'roundedRect', 'circle', 'diamond', 'cylinder'].includes(tool) && (
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'var(--text-muted)' : '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Fill Mode
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { val: 'none', label: 'Hollow' },
                { val: 'tint', label: 'Tint' },
                { val: 'solid', label: 'Solid' }
              ].map(f => (
                <button
                  key={f.val}
                  onClick={() => {
                    setFillStyle(f.val as FillStyle);
                    if (selectedId) {
                      commitChange(elements.map(el => el.id === selectedId ? { ...el, fillStyle: f.val as FillStyle } : el));
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: '6px',
                    background: fillStyle === f.val ? 'var(--accent-primary, #6366f1)' : (isDark ? 'var(--bg-secondary)' : '#f1f5f9'),
                    color: fillStyle === f.val ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
                    fontSize: '10px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stroke Style */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'var(--text-muted)' : '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
            Line Style
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { val: 'solid', label: 'Solid' },
              { val: 'dashed', label: 'Dashed' }
            ].map(s => (
              <button
                key={s.val}
                onClick={() => {
                  setStrokeStyle(s.val as StrokeStyle);
                  if (selectedId) {
                    commitChange(elements.map(el => el.id === selectedId ? { ...el, strokeStyle: s.val as StrokeStyle } : el));
                  }
                }}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: '6px',
                  background: strokeStyle === s.val ? 'var(--accent-primary, #6366f1)' : (isDark ? 'var(--bg-secondary)' : '#f1f5f9'),
                  color: strokeStyle === s.val ? '#fff' : (isDark ? 'var(--text-secondary)' : '#475569'),
                  border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
                  fontSize: '10px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Bottom-Left Action Controls (Export, Copy, Clear) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderRadius: '12px',
        padding: '6px 10px',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)'
      }}>
        <button
          onClick={handleExportPNG}
          className="btn-secondary"
          style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
          title="Download snapshot as PNG image"
        >
          <Download size={13} /> Export PNG
        </button>

        <button
          onClick={handleCopyImage}
          className="btn-secondary"
          style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
          title="Copy diagram image to clipboard"
        >
          <Copy size={13} /> Copy Image
        </button>

        <div style={{ width: '1px', height: '18px', background: isDark ? 'var(--border-color)' : '#e2e8f0' }} />

        <button
          onClick={handleClearAll}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            color: 'var(--status-error, #f43f5e)',
            cursor: 'pointer'
          }}
          title="Clear all strokes from canvas"
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>

      {/* Floating Bottom-Right Zoom & Grid Controls */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderRadius: '12px',
        padding: '6px 10px',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)'
      }}>
        <button
          onClick={() => setGridType(g => g === 'dots' ? 'grid' : g === 'grid' ? 'none' : 'dots')}
          style={{
            padding: '5px 8px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            color: isDark ? 'var(--text-secondary)' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px'
          }}
          title={`Switch grid pattern (Current: ${gridType})`}
        >
          <Grid size={13} /> {gridType.toUpperCase()}
        </button>

        <div style={{ width: '1px', height: '18px', background: isDark ? 'var(--border-color)' : '#e2e8f0' }} />

        <button
          onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}
          style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', color: isDark ? 'var(--text-secondary)' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>

        <span
          onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
          style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f172a', cursor: 'pointer', padding: '0 4px' }}
          title="Click to reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom(z => Math.min(3.0, z + 0.15))}
          style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', color: isDark ? 'var(--text-secondary)' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>

        <button
          onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
          style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', color: isDark ? 'var(--text-secondary)' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Reset View (100%)"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* HTML5 Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          cursor: isSpacePressed || tool === 'hand'
            ? 'grab'
            : tool === 'select'
            ? 'default'
            : tool === 'eraser'
            ? 'not-allowed'
            : tool === 'text'
            ? 'text'
            : 'crosshair',
          touchAction: 'none'
        }}
      />

      {/* Inline Text / Sticky Editor Overlay */}
      {editingText && (
        <div style={{
          position: 'absolute',
          left: `${toScreen(editingText.x, editingText.y).x}px`,
          top: `${toScreen(editingText.x, editingText.y).y}px`,
          zIndex: 50
        }}>
          <textarea
            ref={textAreaRef}
            autoFocus
            value={editingText.text}
            onChange={e => setEditingText(prev => prev ? { ...prev, text: e.target.value } : null)}
            onBlur={commitEditingText}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !editingText.isSticky) {
                e.preventDefault();
                commitEditingText();
              }
              if (e.key === 'Escape') {
                setEditingText(null);
              }
            }}
            placeholder={editingText.isSticky ? 'Type sticky note...' : 'Type text label...'}
            style={{
              width: editingText.isSticky ? `${(editingText.w || 160) * zoom}px` : '220px',
              height: editingText.isSticky ? `${(editingText.h || 140) * zoom}px` : 'auto',
              minHeight: '36px',
              padding: '8px 10px',
              borderRadius: editingText.isSticky ? '8px' : '6px',
              background: editingText.isSticky ? stickyColor : (isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)'),
              color: editingText.isSticky ? '#0f172a' : (color === '#ffffff' && !isDark ? '#0f172a' : color),
              border: '2px solid #6366f1',
              outline: 'none',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: `${(editingText.isSticky ? 13 : fontSize) * zoom}px`,
              fontWeight: '600',
              resize: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}
          />
        </div>
      )}
    </div>
  );
};
