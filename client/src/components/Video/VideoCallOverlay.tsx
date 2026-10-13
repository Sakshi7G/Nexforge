import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../api/socket';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, GripHorizontal } from 'lucide-react';

interface VideoCallOverlayProps {
  onClose: () => void;
}

export const VideoCallOverlay: React.FC<VideoCallOverlayProps> = ({ onClose }) => {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const socket = getSocket();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peers, setPeers] = useState<string[]>([]);

  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(20, window.innerWidth - 360),
    y: Math.max(20, window.innerHeight - 340)
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!activeWorkspace || !user) return;

    const initMediaAndJoin = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err1) {
        console.warn('Audio+Video access failed/denied, trying audio-only fallback:', err1);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = audioStream;
          setCamOn(false);
        } catch (err2) {
          console.warn('Audio-only access failed/denied:', err2);
          setCamOn(false);
          setMicOn(false);
        }
      }

      socket.emit('video:join', {
        workspaceId: activeWorkspace.id,
        userId: user.id,
        userName: user.name
      });
    };

    initMediaAndJoin();

    socket.on('video:existing-peers', (peerList: string[]) => {
      setPeers(peerList);
    });

    socket.on('video:peer-joined', ({ socketId }: { socketId: string }) => {
      setPeers(prev => [...prev, socketId]);
    });

    socket.on('video:peer-left', ({ socketId }: { socketId: string }) => {
      setPeers(prev => prev.filter(id => id !== socketId));
    });

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      socket.emit('video:leave', { workspaceId: activeWorkspace.id });
      socket.off('video:existing-peers');
      socket.off('video:peer-joined');
      socket.off('video:peer-left');
    };
  }, [activeWorkspace, user]);

  // Dragging event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;

      // Clamp within screen boundaries
      const clampedX = Math.max(10, Math.min(window.innerWidth - 330, newX));
      const clampedY = Math.max(10, Math.min(window.innerHeight - 300, newY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 900,
        width: '320px',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        border: '1px solid var(--border-color)',
        userSelect: 'none'
      }}
    >
      {/* Draggable Call Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '10px 14px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          <GripHorizontal size={16} color="var(--text-muted)" />
          <Users size={16} color="var(--accent-primary)" />
          <span>Video Call ({peers.length + 1})</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'var(--status-error)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '26px',
            height: '26px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PhoneOff size={14} />
        </button>
      </div>

      {/* Video Stream Container */}
      <div style={{ padding: '12px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Local Video Stream */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '180px',
          background: 'var(--bg-tertiary)',
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            background: 'rgba(0,0,0,0.65)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#fff',
            fontWeight: 500
          }}>
            {user?.name} (You)
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{
        padding: '10px',
        background: 'var(--bg-secondary)',
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <button
          onClick={toggleMic}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: micOn ? 'var(--bg-tertiary)' : 'var(--status-error)',
            color: micOn ? 'var(--text-primary)' : '#fff',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button
          onClick={toggleCam}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: camOn ? 'var(--bg-tertiary)' : 'var(--status-error)',
            color: camOn ? 'var(--text-primary)' : '#fff',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
      </div>
    </div>
  );
};
