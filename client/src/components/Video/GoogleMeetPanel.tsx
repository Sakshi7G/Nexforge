import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../api/socket';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, MonitorStop, Hand, PhoneOff,
  Users, Shield, CircleDot, Square, Volume2, RotateCcw, AlertCircle
} from 'lucide-react';

interface PeerConnection {
  socketId: string;
  userId?: string;
  userName: string;
  stream?: MediaStream;
  latestFrame?: string;
  isMuted?: boolean;
  isCamOff?: boolean;
  isSharingScreen?: boolean;
  isHandRaised?: boolean;
  connectionState?: string;
  lastFrameTimestamp?: number;
}

// Dedicated Remote Peer Tile component with zero black screens, dual streaming (WebSocket + WebRTC), and screen fitting
const RemotePeerTile: React.FC<{
  peer: PeerConnection;
  totalParticipants: number;
  onReconnect: (socketId: string) => void;
}> = ({ peer, totalParticipants, onReconnect }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && peer.stream) {
      if (videoEl.srcObject !== peer.stream) {
        videoEl.srcObject = peer.stream;
      }
      videoEl.play().catch(() => {});
    }

    const audioEl = audioRef.current;
    if (audioEl && peer.stream) {
      if (audioEl.srcObject !== peer.stream) {
        audioEl.srcObject = peer.stream;
      }
      audioEl.play().catch(() => {});
    }
  }, [peer.stream]);

  const isCamOff = peer.isCamOff && !peer.isSharingScreen;
  const isFailed = peer.connectionState === 'failed' || peer.connectionState === 'disconnected';
  const hasLiveFrame = Boolean(peer.latestFrame);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      maxHeight: totalParticipants === 1 ? '78vh' : '100%',
      background: '#161b22',
      borderRadius: '16px',
      overflow: 'hidden',
      border: peer.isHandRaised ? '2px solid #f59e0b' : peer.isSharingScreen ? '2px solid #6366f1' : '1px solid var(--border-color)',
      boxShadow: peer.isHandRaised ? '0 0 20px rgba(245, 158, 11, 0.3)' : '0 10px 30px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* 1. Direct High-Performance Frame Stream (Bypasses all WebRTC NAT/Firewall blocking) */}
      {!isCamOff && hasLiveFrame && (
        <img
          src={peer.latestFrame}
          alt={`${peer.userName}'s stream`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: peer.isSharingScreen ? 'contain' : 'cover',
            background: '#0d1117'
          }}
        />
      )}

      {/* 2. WebRTC Video Element (plays in parallel if WebRTC P2P succeeds) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: peer.isSharingScreen ? 'contain' : 'cover',
          opacity: isCamOff || hasLiveFrame ? 0 : 1,
          pointerEvents: isCamOff ? 'none' : 'auto',
          background: '#0d1117'
        }}
      />

      {/* 3. Secondary Backup Audio Element for WebRTC audio tracks */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={true}
      />

      {/* 4. Fallback Avatar when camera is turned off and not screen sharing */}
      {isCamOff && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--accent-secondary)',
            color: '#fff',
            fontSize: '28px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)'
          }}>
            {peer.userName ? peer.userName.slice(0, 2).toUpperCase() : 'U'}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Camera Turned Off</span>
        </div>
      )}

      {/* 5. Screen sharing banner */}
      {peer.isSharingScreen && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(99, 102, 241, 0.9)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10
        }}>
          <Monitor size={13} /> {peer.userName}'s Screen
        </div>
      )}

      {/* 6. Hand Raised badge */}
      {peer.isHandRaised && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: '#f59e0b',
          color: '#000',
          fontSize: '11px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 10
        }}>
          <Hand size={13} /> Hand Raised
        </div>
      )}

      {/* 7. Reconnect Call button if connection drops */}
      {isFailed && !hasLiveFrame && (
        <button
          onClick={() => onReconnect(peer.socketId)}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(239, 68, 68, 0.9)',
            border: 'none',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Click to reconnect call"
        >
          <RotateCcw size={12} /> Reconnect
        </button>
      )}

      {/* 8. Remote Participant Footer: Mic Status, Name, and Audio Activity */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        background: 'rgba(10, 13, 20, 0.8)',
        backdropFilter: 'blur(8px)',
        padding: '5px 12px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: '#fff',
        fontWeight: 600,
        border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 10
      }}>
        {peer.isMuted ? <MicOff size={13} color="#ef4444" /> : <Mic size={13} color="#10b981" />}
        <span>{peer.userName}</span>
        {!peer.isMuted && <Volume2 size={12} color="#10b981" />}
      </div>
    </div>
  );
};

export const GoogleMeetPanel: React.FC<{ onLeave?: () => void }> = ({ onLeave }) => {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const socket = getSocket();

  const queryParams = new URLSearchParams(window.location.search);
  const roomUrlId = queryParams.get('room') || queryParams.get('roomId');
  const roomId = activeWorkspace?.id || roomUrlId || 'default-room';

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioNeedsClick, setAudioNeedsClick] = useState(false);

  // Meeting Recording State & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const isRecordingRef = useRef<boolean>(false);
  const recTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<any>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordRenderIntervalRef = useRef<any>(null);
  const recordAudioCtxRef = useRef<AudioContext | null>(null);
  const recordAudioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const peerImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Dynamic live state mirrors for recording composite
  const userRef = useRef(user);
  userRef.current = user;
  const activeWorkspaceRef = useRef(activeWorkspace);
  activeWorkspaceRef.current = activeWorkspace;
  const camOnRef = useRef(camOn);
  camOnRef.current = camOn;
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;
  const isSharingScreenRef = useRef(isSharingScreen);
  isSharingScreenRef.current = isSharingScreen;
  const handRaisedRef = useRef(handRaised);
  handRaisedRef.current = handRaised;
  const [peersMap, setPeersMap] = useState<Map<string, PeerConnection>>(new Map());
  const peersMapRef = useRef(peersMap);
  peersMapRef.current = peersMap;
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const iceCandidatesQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Audio Streaming Refs (Web Audio API)
  const txAudioCtxRef = useRef<AudioContext | null>(null);
  const txProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const rxAudioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimesRef = useRef<Map<string, number>>(new Map());

  // Video Frame Streaming Offscreen Canvas & Timer
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameStreamIntervalRef = useRef<any>(null);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Rx Audio Context for receiving peer audio
  const getRxAudioContext = () => {
    if (!rxAudioCtxRef.current || rxAudioCtxRef.current.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      rxAudioCtxRef.current = new AudioCtxClass({ sampleRate: 16000 });
      nextPlayTimesRef.current.clear();
    }
    return rxAudioCtxRef.current;
  };

  // Global user interaction listener to resume audio context if suspended by browser
  useEffect(() => {
    const handleGlobalInteraction = () => {
      if (rxAudioCtxRef.current && rxAudioCtxRef.current.state === 'suspended') {
        rxAudioCtxRef.current.resume().then(() => {
          setAudioNeedsClick(false);
        }).catch(() => {});
      }
      document.querySelectorAll('audio, video').forEach((el: any) => {
        el.play().catch(() => {});
      });
    };

    window.addEventListener('click', handleGlobalInteraction);
    window.addEventListener('touchstart', handleGlobalInteraction);
    window.addEventListener('keydown', handleGlobalInteraction);

    return () => {
      window.removeEventListener('click', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
      window.removeEventListener('keydown', handleGlobalInteraction);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // High-reliability WebRTC ICE configuration with Google STUN & Cloudflare STUN
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  // Start sending microphone audio chunks via Web Audio API ScriptProcessor
  const startAudioStreaming = (stream: MediaStream) => {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!txAudioCtxRef.current || txAudioCtxRef.current.state === 'closed') {
        txAudioCtxRef.current = new AudioCtxClass({ sampleRate: 16000 });
      }

      const audioCtx = txAudioCtxRef.current;
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      // 1024 samples @ 16kHz = 64ms chunks for ultra-responsive conversational voice
      const processor = audioCtx.createScriptProcessor(1024, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16Array
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
        }

        socket.emit('video:audio-chunk', {
          workspaceId: roomId,
          chunk: int16.buffer
        });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      txProcessorRef.current = processor;
    } catch (err) {
      console.warn('[WebAudio] Could not start audio chunk streamer:', err);
    }
  };

  const stopAudioStreaming = () => {
    if (txProcessorRef.current) {
      try {
        txProcessorRef.current.disconnect();
      } catch {}
      txProcessorRef.current = null;
    }
    if (txAudioCtxRef.current) {
      try {
        txAudioCtxRef.current.close();
      } catch {}
      txAudioCtxRef.current = null;
    }
  };

  // Start sending video/screen frames at ~14 FPS over WebSocket
  const startVideoFrameStreaming = () => {
    if (frameStreamIntervalRef.current) clearInterval(frameStreamIntervalRef.current);

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const canvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext('2d');

    frameStreamIntervalRef.current = setInterval(() => {
      const videoEl = localVideoRef.current;
      if (!videoEl || videoEl.readyState < 2 || !ctx) return;

      if (isSharingScreen) {
        // High-definition screen frame capture
        canvas.width = 854;
        canvas.height = 480;
        ctx.drawImage(videoEl, 0, 0, 854, 480);
        const frame = canvas.toDataURL('image/webp', 0.65);
        socket.emit('video:frame', {
          workspaceId: roomId,
          frame,
          isScreen: true
        });
      } else if (camOn) {
        // Standard video frame capture
        canvas.width = 480;
        canvas.height = 360;
        ctx.drawImage(videoEl, 0, 0, 480, 360);
        const frame = canvas.toDataURL('image/webp', 0.55);
        socket.emit('video:frame', {
          workspaceId: roomId,
          frame,
          isScreen: false
        });
      }
    }, 70);
  };

  const stopVideoFrameStreaming = () => {
    if (frameStreamIntervalRef.current) {
      clearInterval(frameStreamIntervalRef.current);
      frameStreamIntervalRef.current = null;
    }
  };

  // Helper to drain queued ICE candidates once remote description is set
  const processQueuedIceCandidates = async (targetSocketId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidatesQueueRef.current.get(targetSocketId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (candidate && candidate.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Failed to add queued ICE candidate:', err);
        }
      }
    }
    iceCandidatesQueueRef.current.delete(targetSocketId);
  };

  const createPeerConnection = (targetSocketId: string, isInitiator: boolean, userName = 'Teammate') => {
    const existing = peerConnectionsRef.current.get(targetSocketId);
    if (existing) {
      existing.close();
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Attach local stream tracks if available
    const currentStream = isSharingScreen && screenStreamRef.current ? screenStreamRef.current : localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        pc.addTrack(track, currentStream);
      });
    }

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      setPeersMap(prev => {
        const next = new Map(prev);
        const item = next.get(targetSocketId);
        if (item) {
          next.set(targetSocketId, { ...item, connectionState: pc.connectionState });
        }
        return next;
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('video:ice-candidate', {
          toSocketId: targetSocketId,
          candidate: e.candidate.toJSON ? e.candidate.toJSON() : {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex
          }
        });
      }
    };

    pc.ontrack = (e) => {
      let stream = remoteStreamsRef.current.get(targetSocketId);
      if (!stream) {
        stream = new MediaStream();
        remoteStreamsRef.current.set(targetSocketId, stream);
      }

      if (e.track && !stream.getTracks().some(t => t.id === e.track.id)) {
        stream.addTrack(e.track);
      }

      const freshStream = new MediaStream(stream.getTracks());
      setPeersMap(prev => {
        const next = new Map(prev);
        const existingItem = next.get(targetSocketId) || { socketId: targetSocketId, userName };
        next.set(targetSocketId, {
          ...existingItem,
          userName: existingItem.userName || userName,
          stream: freshStream,
          isCamOff: false
        });
        return next;
      });
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            socket.emit('video:offer', {
              toSocketId: targetSocketId,
              offer: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp
              }
            });
          }
        })
        .catch(err => console.error('[WebRTC] Error creating offer:', err));
    }

    setPeersMap(prev => {
      const next = new Map(prev);
      if (!next.has(targetSocketId)) {
        next.set(targetSocketId, { socketId: targetSocketId, userName });
      }
      return next;
    });

    return pc;
  };

  const handleReconnectPeer = (targetSocketId: string) => {
    const shouldInitiate = Boolean(socket.id && socket.id < targetSocketId);
    createPeerConnection(targetSocketId, shouldInitiate);
  };

  // Main Effect: Initialize Media, Sockets, and Streamers
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const initMediaAndJoin = async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
          }
        });
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err1) {
        console.warn('[WebRTC] Audio+Video access failed, falling back to audio only:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          localStreamRef.current = stream;
          setCamOn(false);
        } catch (err2) {
          console.warn('[WebRTC] Audio access failed, creating empty placeholder stream:', err2);
          stream = new MediaStream();
          localStreamRef.current = stream;
          setCamOn(false);
          setMicOn(false);
        }
      }

      // Start direct WebSocket audio streaming if microphone is available
      if (stream.getAudioTracks().length > 0) {
        startAudioStreaming(stream);
      }

      // Start direct WebSocket video frame streaming
      startVideoFrameStreaming();

      // Emit video:join with user identity
      socket.emit('video:join', {
        workspaceId: roomId,
        userId: user.id,
        userName: user.name
      });
    };

    initMediaAndJoin();

    // Socket Event Handlers
    const handleExistingPeers = (peerList: Array<{ socketId: string; userId: string; userName: string } | string>) => {
      peerList.forEach(item => {
        const socketId = typeof item === 'string' ? item : item.socketId;
        const userName = typeof item === 'string' ? 'Teammate' : item.userName;
        const isInitiator = Boolean(socket.id && socket.id < socketId);
        createPeerConnection(socketId, isInitiator, userName);
      });
    };

    const handlePeerJoined = ({ socketId, userName }: { socketId: string; userName: string }) => {
      const isInitiator = Boolean(socket.id && socket.id < socketId);
      createPeerConnection(socketId, isInitiator, userName);
    };

    // Live Video & Screen Share Frame Handler (WebSocket stream)
    const handlePeerFrame = ({ socketId, frame, isScreen }: { socketId: string; frame: string; isScreen: boolean }) => {
      // Pre-cache image for canvas compositing
      let cachedImg = peerImagesRef.current.get(socketId);
      if (!cachedImg) {
        cachedImg = new Image();
        peerImagesRef.current.set(socketId, cachedImg);
      }
      cachedImg.src = frame;

      setPeersMap(prev => {
        const next = new Map(prev);
        const existing = next.get(socketId);
        if (existing) {
          next.set(socketId, {
            ...existing,
            latestFrame: frame,
            isSharingScreen: isScreen,
            isCamOff: false,
            lastFrameTimestamp: Date.now()
          });
        }
        return next;
      });
    };

    // Live Audio Chunk Handler (Web Audio API direct playback)
    const handlePeerAudioChunk = ({ socketId, chunk }: { socketId: string; chunk: ArrayBuffer }) => {
      const peer = peersMap.get(socketId);
      if (peer && peer.isMuted) return;

      try {
        const audioCtx = getRxAudioContext();
        if (audioCtx.state === 'suspended') {
          setAudioNeedsClick(true);
          return;
        }

        const int16 = new Int16Array(chunk);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32767;
        }

        const audioBuffer = audioCtx.createBuffer(1, float32.length, 16000);
        audioBuffer.copyToChannel(float32, 0);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        let peerNextPlayTime = nextPlayTimesRef.current.get(socketId) || now;

        // Zero-Lag Resync Guard:
        // If scheduled playback fell into the past (< now) OR drifted more than 60ms ahead of current time:
        // IMMEDIATELY clamp back to real time (now + 15ms)!
        // This permanently eliminates any audio delay/lag accumulation over time!
        if (peerNextPlayTime < now || peerNextPlayTime > now + 0.060) {
          peerNextPlayTime = now + 0.015;
        }

        source.start(peerNextPlayTime);
        peerNextPlayTime += audioBuffer.duration;
        nextPlayTimesRef.current.set(socketId, peerNextPlayTime);

        // Mix remote peer voice into meeting recording stream if recording is active!
        if (isRecordingRef.current && recordAudioCtxRef.current && recordAudioDestRef.current) {
          try {
            const recCtx = recordAudioCtxRef.current;
            const recBuffer = recCtx.createBuffer(1, float32.length, 16000);
            recBuffer.copyToChannel(float32, 0);
            const recSrc = recCtx.createBufferSource();
            recSrc.buffer = recBuffer;
            recSrc.connect(recordAudioDestRef.current);
            recSrc.start();
          } catch {}
        }
      } catch (err) {
        console.warn('[WebAudio] Error playing audio chunk:', err);
      }
    };

    const handleOffer = async ({ fromSocketId, offer }: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
      if (!offer || !offer.sdp) return;
      let pc = peerConnectionsRef.current.get(fromSocketId);
      if (!pc) {
        pc = createPeerConnection(fromSocketId, false);
      }

      try {
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await processQueuedIceCandidates(fromSocketId, pc);

        socket.emit('video:answer', {
          toSocketId: fromSocketId,
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        });
      } catch (err) {
        console.error('[WebRTC] Error processing offer:', err);
      }
    };

    const handleAnswer = async ({ fromSocketId, answer }: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
      if (!answer || !answer.sdp) return;
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processQueuedIceCandidates(fromSocketId, pc);
        } catch (err) {
          console.error('[WebRTC] Error processing answer:', err);
        }
      }
    };

    const handleIceCandidate = async ({ fromSocketId, candidate }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      if (!candidate || !candidate.candidate) return;
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Failed to add ICE candidate:', err);
        }
      } else {
        const queue = iceCandidatesQueueRef.current.get(fromSocketId) || [];
        queue.push(candidate);
        iceCandidatesQueueRef.current.set(fromSocketId, queue);
      }
    };

    const handlePeerMicToggle = ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
      setPeersMap(prev => {
        const next = new Map(prev);
        const existing = next.get(socketId);
        if (existing) {
          next.set(socketId, { ...existing, isMuted });
        }
        return next;
      });
    };

    const handlePeerCamToggle = ({ socketId, isCamOff }: { socketId: string; isCamOff: boolean }) => {
      setPeersMap(prev => {
        const next = new Map(prev);
        const existing = next.get(socketId);
        if (existing) {
          next.set(socketId, {
            ...existing,
            isCamOff,
            latestFrame: isCamOff ? undefined : existing.latestFrame
          });
        }
        return next;
      });
    };

    const handlePeerScreenToggle = ({ socketId, isSharingScreen }: { socketId: string; isSharingScreen: boolean }) => {
      setPeersMap(prev => {
        const next = new Map(prev);
        const existing = next.get(socketId);
        if (existing) {
          next.set(socketId, { ...existing, isSharingScreen });
        }
        return next;
      });
    };

    const handlePeerRaiseHand = ({ socketId, isHandRaised }: { socketId: string; isHandRaised: boolean }) => {
      setPeersMap(prev => {
        const next = new Map(prev);
        const existing = next.get(socketId);
        if (existing) {
          next.set(socketId, { ...existing, isHandRaised });
        }
        return next;
      });
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      peerImagesRef.current.delete(socketId);
      const pc = peerConnectionsRef.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(socketId);
      }
      remoteStreamsRef.current.delete(socketId);
      setPeersMap(prev => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    socket.on('video:existing-peers', handleExistingPeers);
    socket.on('video:peer-joined', handlePeerJoined);
    socket.on('video:peer-frame', handlePeerFrame);
    socket.on('video:peer-audio-chunk', handlePeerAudioChunk);
    socket.on('video:offer', handleOffer);
    socket.on('video:answer', handleAnswer);
    socket.on('video:ice-candidate', handleIceCandidate);
    socket.on('video:peer-mic-toggle', handlePeerMicToggle);
    socket.on('video:peer-cam-toggle', handlePeerCamToggle);
    socket.on('video:peer-screen-toggle', handlePeerScreenToggle);
    socket.on('video:peer-raise-hand', handlePeerRaiseHand);
    socket.on('video:peer-left', handlePeerLeft);

    return () => {
      isMounted = false;
      stopMeetingRecording();
      stopAudioStreaming();
      stopVideoFrameStreaming();

      if (rxAudioCtxRef.current) {
        try { rxAudioCtxRef.current.close(); } catch {}
        rxAudioCtxRef.current = null;
      }
      nextPlayTimesRef.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      remoteStreamsRef.current.clear();

      socket.emit('video:leave', { workspaceId: roomId });
      socket.off('video:existing-peers', handleExistingPeers);
      socket.off('video:peer-joined', handlePeerJoined);
      socket.off('video:peer-frame', handlePeerFrame);
      socket.off('video:peer-audio-chunk', handlePeerAudioChunk);
      socket.off('video:offer', handleOffer);
      socket.off('video:answer', handleAnswer);
      socket.off('video:ice-candidate', handleIceCandidate);
      socket.off('video:peer-mic-toggle', handlePeerMicToggle);
      socket.off('video:peer-cam-toggle', handlePeerCamToggle);
      socket.off('video:peer-screen-toggle', handlePeerScreenToggle);
      socket.off('video:peer-raise-hand', handlePeerRaiseHand);
      socket.off('video:peer-left', handlePeerLeft);
    };
  }, [roomId, user]);

  const toggleMic = async () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const nextMicState = !micOn;

    if (audioTrack) {
      audioTrack.enabled = nextMicState;
    }
    setMicOn(nextMicState);

    if (nextMicState && localStreamRef.current) {
      startAudioStreaming(localStreamRef.current);
    } else {
      stopAudioStreaming();
    }

    socket.emit('video:toggle-mic', { workspaceId: roomId, isMuted: !nextMicState });
  };

  const toggleCam = async () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    const nextCamState = !camOn;

    if (videoTrack) {
      videoTrack.enabled = nextCamState;
    }
    setCamOn(nextCamState);

    socket.emit('video:toggle-cam', { workspaceId: roomId, isCamOff: !nextCamState });
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsSharingScreen(false);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    for (const [, pc] of peerConnectionsRef.current.entries()) {
      const videoSender = pc.getSenders().find(s => s.track?.kind === 'video' || (s as any).kind === 'video');
      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      }
    }

    socket.emit('video:toggle-screen', { workspaceId: roomId, isSharingScreen: false });
    socket.emit('video:toggle-cam', { workspaceId: roomId, isCamOff: !camOn });
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      await stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          } as any,
          audio: true
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.contentHint = 'detail';

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsSharingScreen(true);

        for (const [, pc] of peerConnectionsRef.current.entries()) {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video' || (s as any).kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, screenStream);
          }
        }

        socket.emit('video:toggle-screen', { workspaceId: roomId, isSharingScreen: true });
        socket.emit('video:toggle-cam', { workspaceId: roomId, isCamOff: false });

        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.warn('[WebRTC] Screen share canceled or failed:', err);
      }
    }
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if ((ctx as any).roundRect) {
      ctx.beginPath();
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  };

  const drawFittedMedia = (
    ctx: CanvasRenderingContext2D,
    media: HTMLVideoElement | HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    fit: 'cover' | 'contain'
  ) => {
    const mw = (media as HTMLVideoElement).videoWidth || (media as HTMLImageElement).naturalWidth || (media as any).width || 0;
    const mh = (media as HTMLVideoElement).videoHeight || (media as HTMLImageElement).naturalHeight || (media as any).height || 0;

    if (mw <= 0 || mh <= 0) return;

    const scale = fit === 'cover' ? Math.max(w / mw, h / mh) : Math.min(w / mw, h / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    ctx.drawImage(media, dx, dy, dw, dh);
  };

  const drawTileOnCanvas = (
    ctx: CanvasRenderingContext2D,
    p: any,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    ctx.save();

    // Rounded rectangle card path
    drawRoundedRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = '#161b22';
    ctx.fill();

    // Card border
    if (p.isHandRaised) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
    } else if (p.isSharingScreen) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();

    // Clip content to card's rounded boundary
    ctx.clip();

    let hasDrawn = false;

    if (p.isLocal && p.videoEl && p.videoEl.readyState >= 2 && !p.isCamOff) {
      ctx.save();
      if (!p.isSharingScreen) {
        // Mirror local camera for natural selfie view
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        drawFittedMedia(ctx, p.videoEl, 0, 0, w, h, 'cover');
      } else {
        drawFittedMedia(ctx, p.videoEl, x, y, w, h, 'contain');
      }
      ctx.restore();
      hasDrawn = true;
    } else if (!p.isLocal && p.imgEl && p.imgEl.complete && p.imgEl.naturalWidth > 0 && !p.isCamOff) {
      drawFittedMedia(ctx, p.imgEl, x, y, w, h, p.isSharingScreen ? 'contain' : 'cover');
      hasDrawn = true;
    }

    if (!hasDrawn) {
      // Draw participant initials avatar
      const cx = x + w / 2;
      const cy = y + h / 2 - 14;
      const avatarR = Math.max(20, Math.min(38, Math.floor(Math.min(w, h) * 0.18)));

      ctx.fillStyle = p.isLocal ? '#6366f1' : '#8b5cf6';
      ctx.beginPath();
      ctx.arc(cx, cy, avatarR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(avatarR * 0.85)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = p.name ? p.name.slice(0, 2).toUpperCase() : 'U';
      ctx.fillText(initials, cx, cy);

      ctx.fillStyle = '#8b949e';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Camera Turned Off', cx, cy + avatarR + 20);
    }

    // Top-left: Presenting badge
    if (p.isSharingScreen) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
      drawRoundedRect(ctx, x + 10, y + 10, 105, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🖥️ Presenting', x + 62, y + 21);
    }

    // Top-right: Hand Raised badge
    if (p.isHandRaised) {
      ctx.fillStyle = '#f59e0b';
      drawRoundedRect(ctx, x + w - 105, y + 10, 95, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✋ Hand Raised', x + w - 58, y + 21);
    }

    // Bottom-left: Name pill with mic status
    const badgeH = 26;
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const nameWidth = ctx.measureText(p.name).width;
    const badgeW = nameWidth + 36;
    const badgeX = x + 10;
    const badgeY = y + h - badgeH - 10;

    ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mic indicator dot
    ctx.fillStyle = p.isMuted ? '#ef4444' : '#10b981';
    ctx.beginPath();
    ctx.arc(badgeX + 12, badgeY + badgeH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name, badgeX + 22, badgeY + badgeH / 2);

    ctx.restore();
  };

  const drawMeetingFrame = () => {
    const canvas = recordCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1280;
    const H = 720;

    // Dark canvas background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Header bar
    ctx.fillStyle = 'rgba(18, 24, 36, 0.95)';
    ctx.fillRect(0, 0, W, 46);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(W, 46);
    ctx.stroke();

    // Live Meeting Green Dot + Title
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(24, 23, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`NexForge Meet • ${activeWorkspaceRef.current?.name || 'Live Call'}`, 36, 23);

    // Flashing Red Recording Indicator
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(W - 130, 23, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('REC', W - 118, 23);

    ctx.fillStyle = '#8b949e';
    ctx.font = '12px monospace';
    ctx.fillText(formatDuration(recTimeRef.current), W - 85, 23);

    // Gather all meeting participants
    const localP = {
      id: 'local',
      name: userRef.current?.name ? `${userRef.current.name} (You)` : 'You (You)',
      isLocal: true,
      isCamOff: !camOnRef.current && !isSharingScreenRef.current,
      isMuted: !micOnRef.current,
      isSharingScreen: isSharingScreenRef.current,
      isHandRaised: handRaisedRef.current,
      videoEl: localVideoRef.current,
      imgEl: null
    };

    const remotePs = Array.from(peersMapRef.current.values()).map(p => ({
      id: p.socketId,
      name: p.userName || 'Teammate',
      isLocal: false,
      isCamOff: p.isCamOff && !p.isSharingScreen,
      isMuted: p.isMuted,
      isSharingScreen: p.isSharingScreen,
      isHandRaised: p.isHandRaised,
      videoEl: null,
      imgEl: peerImagesRef.current.get(p.socketId) || null
    }));

    const allP = [localP, ...remotePs];
    const presenter = allP.find(p => p.isSharingScreen);

    const stageX = 20;
    const stageY = 58;
    const stageW = W - 40;
    const stageH = H - 76;

    if (presenter) {
      // Screen Share Mode: Presenter has dominant view, other participants queued on right
      const mainW = allP.length > 1 ? Math.floor(stageW * 0.74) : stageW;
      const mainH = stageH;

      drawTileOnCanvas(ctx, presenter, stageX, stageY, mainW, mainH);

      if (allP.length > 1) {
        const thumbX = stageX + mainW + 16;
        const thumbW = stageW - mainW - 16;
        const others = allP.filter(p => p.id !== presenter.id);
        const thumbH = Math.min(180, Math.floor((stageH - (others.length - 1) * 12) / others.length));

        others.forEach((p, idx) => {
          const thumbY = stageY + idx * (thumbH + 12);
          drawTileOnCanvas(ctx, p, thumbX, thumbY, thumbW, thumbH);
        });
      }
    } else {
      // Normal Video Grid Mode
      const N = allP.length;
      let cols = 1;
      let rows = 1;

      if (N === 1) {
        cols = 1; rows = 1;
      } else if (N === 2) {
        cols = 2; rows = 1; // 2 participants side-by-side
      } else if (N <= 4) {
        cols = 2; rows = 2;
      } else if (N <= 6) {
        cols = 3; rows = 2;
      } else {
        cols = 3; rows = Math.ceil(N / 3);
      }

      const gap = 16;
      const tileW = Math.floor((stageW - (cols - 1) * gap) / cols);
      const tileH = Math.floor((stageH - (rows - 1) * gap) / rows);

      allP.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = stageX + col * (tileW + gap);
        const y = stageY + row * (tileH + gap);
        drawTileOnCanvas(ctx, p, x, y, tileW, tileH);
      });
    }
  };

  const stopMeetingRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (recordRenderIntervalRef.current) {
      clearInterval(recordRenderIntervalRef.current);
      recordRenderIntervalRef.current = null;
    }
    if (recordAudioCtxRef.current) {
      try { recordAudioCtxRef.current.close(); } catch {}
      recordAudioCtxRef.current = null;
      recordAudioDestRef.current = null;
    }
    setIsRecording(false);
    setRecTime(0);
    recTimeRef.current = 0;
  };

  const toggleMeetingRecording = async () => {
    if (isRecording) {
      stopMeetingRecording();
    } else {
      try {
        // 1. Setup 1280x720 Canvas Compositor
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        recordCanvasRef.current = canvas;

        // 2. Setup Audio Mixer Context to combine local mic + all remote peer voices
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        const recAudioCtx = new AudioCtxClass();
        if (recAudioCtx.state === 'suspended') {
          await recAudioCtx.resume().catch(() => {});
        }
        recordAudioCtxRef.current = recAudioCtx;
        const recDest = recAudioCtx.createMediaStreamDestination();
        recordAudioDestRef.current = recDest;

        // Connect local microphone to recorder audio mixer
        if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
          try {
            const localMicSource = recAudioCtx.createMediaStreamSource(localStreamRef.current);
            localMicSource.connect(recDest);
          } catch (e) {
            console.warn('[MeetingRecorder] Could not connect local mic to recorder:', e);
          }
        }

        // 3. Start Canvas Drawing Loop at 30 FPS
        drawMeetingFrame();
        recordRenderIntervalRef.current = setInterval(drawMeetingFrame, 1000 / 30);

        // 4. Capture combined video + mixed audio stream
        const canvasStream = canvas.captureStream(30);
        const mixedAudioTrack = recDest.stream.getAudioTracks()[0];
        const streamToRecord = new MediaStream([
          canvasStream.getVideoTracks()[0],
          ...(mixedAudioTrack ? [mixedAudioTrack] : [])
        ]);

        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8,opus';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        const recorder = new MediaRecorder(streamToRecord, {
          mimeType,
          videoBitsPerSecond: 2500000
        });
        recChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          a.download = `NexForge_Meeting_${timestamp}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
          alert('Meeting recording saved successfully to your Downloads folder!');
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        isRecordingRef.current = true;
        setRecTime(0);
        recTimeRef.current = 0;

        recTimerRef.current = setInterval(() => {
          setRecTime(prev => {
            recTimeRef.current = prev + 1;
            return prev + 1;
          });
        }, 1000);
      } catch (err: any) {
        alert(`Failed to start recording: ${err.message}`);
      }
    }
  };

  const toggleRaiseHand = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    socket.emit('video:raise-hand', { workspaceId: roomId, isHandRaised: nextState });
  };

  const handleUnblockAudio = () => {
    if (rxAudioCtxRef.current) {
      rxAudioCtxRef.current.resume().then(() => {
        setAudioNeedsClick(false);
      });
    }
  };

  const totalParticipants = peersMap.size + 1;

  const getGridTemplate = () => {
    if (totalParticipants === 1) return '1fr';
    if (totalParticipants === 2) return '1fr 1fr';
    if (totalParticipants <= 4) return 'repeat(2, 1fr)';
    return 'repeat(3, 1fr)';
  };

  return (
    <div style={{
      flex: 1,
      width: '100%',
      height: '100%',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Top Header Bar */}
      <div style={{
        height: '48px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(18, 24, 36, 0.9)',
        borderBottom: '1px solid var(--border-color)',
        backdropFilter: 'blur(10px)',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>
              NexForge Meet • {activeWorkspace?.name || 'Live Call'}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'Fira Code', monospace" }}>
            {formatDuration(callDuration)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Audio Unblock Banner if browser suspended audio playback */}
          {audioNeedsClick && (
            <button
              onClick={handleUnblockAudio}
              style={{
                fontSize: '11px',
                color: '#fff',
                background: '#f59e0b',
                padding: '4px 10px',
                borderRadius: '12px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                animation: 'pulse 2s infinite'
              }}
            >
              <Volume2 size={13} /> Click to Enable Audio
            </button>
          )}

          {/* Record Meeting Button */}
          <button
            onClick={toggleMeetingRecording}
            style={{
              fontSize: '12px',
              color: isRecording ? '#fff' : '#ef4444',
              background: isRecording ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
              padding: '5px 12px',
              borderRadius: '16px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isRecording ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none'
            }}
            title={isRecording ? 'Stop Recording' : 'Start Recording Meeting'}
          >
            {isRecording ? <Square size={12} fill="#fff" /> : <CircleDot size={14} color="#ef4444" />}
            <span>{isRecording ? `REC ${formatDuration(recTime)}` : 'Record Meeting'}</span>
          </button>

          <div style={{
            fontSize: '11px',
            color: 'var(--status-success)',
            background: 'rgba(16, 185, 129, 0.12)',
            padding: '3px 10px',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Shield size={12} /> Encrypted Live Call
          </div>

          <button
            onClick={() => setShowParticipants(!showParticipants)}
            style={{
              background: showParticipants ? 'var(--bg-active)' : 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Users size={14} />
            <span>{totalParticipants}</span>
          </button>
        </div>
      </div>

      {/* Main Video Stage Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: '16px',
        gap: '16px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Responsive Video Tiles Grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: getGridTemplate(),
          gap: '14px',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Local User Video Tile */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            maxHeight: totalParticipants === 1 ? '78vh' : '100%',
            background: '#161b22',
            borderRadius: '16px',
            overflow: 'hidden',
            border: handRaised ? '2px solid #f59e0b' : isSharingScreen ? '2px solid #6366f1' : '1px solid var(--border-color)',
            boxShadow: handRaised ? '0 0 20px rgba(245, 158, 11, 0.3)' : '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted={true}
              style={{
                width: '100%',
                height: '100%',
                objectFit: isSharingScreen ? 'contain' : 'cover',
                transform: isSharingScreen ? 'none' : 'scaleX(-1)',
                display: camOn || isSharingScreen ? 'block' : 'none',
                background: '#0d1117'
              }}
            />

            {!camOn && !isSharingScreen && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontSize: '28px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
                }}>
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
                </div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Camera Turned Off</span>
              </div>
            )}

            {isSharingScreen && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(99, 102, 241, 0.9)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Monitor size={13} /> You are Presenting
              </div>
            )}

            {handRaised && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#f59e0b',
                color: '#000',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Hand size={13} /> Hand Raised
              </div>
            )}

            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(10, 13, 20, 0.8)',
              backdropFilter: 'blur(8px)',
              padding: '5px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#fff',
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {micOn ? <Mic size={13} color="#10b981" /> : <MicOff size={13} color="#ef4444" />}
              <span>{user?.name || 'You'} (You)</span>
            </div>
          </div>

          {/* Remote Participants Video Tiles */}
          {Array.from(peersMap.values()).map(peer => (
            <RemotePeerTile
              key={peer.socketId}
              peer={peer}
              totalParticipants={totalParticipants}
              onReconnect={handleReconnectPeer}
            />
          ))}
        </div>

        {/* Side Participants Drawer */}
        {showParticipants && (
          <div className="glass-panel animate-fade-in" style={{
            width: '280px',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid var(--border-color)',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                People ({totalParticipants})
              </span>
              <button
                onClick={() => setShowParticipants(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
                  </div>
                  <span>{user?.name} (You)</span>
                </div>
                {micOn ? <Mic size={14} color="#10b981" /> : <MicOff size={14} color="#ef4444" />}
              </div>

              {Array.from(peersMap.values()).map(peer => (
                <div key={peer.socketId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-secondary)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {peer.userName ? peer.userName.slice(0, 2).toUpperCase() : 'U'}
                    </div>
                    <span>{peer.userName}</span>
                  </div>
                  {peer.isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} color="#10b981" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar (Google Meet Style) */}
      <div style={{
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '0 24px',
        background: 'rgba(18, 24, 36, 0.95)',
        borderTop: '1px solid var(--border-color)',
        backdropFilter: 'blur(10px)',
        zIndex: 20
      }}>
        {/* Toggle Microphone */}
        <button
          onClick={toggleMic}
          title={micOn ? 'Turn off microphone' : 'Turn on microphone'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: micOn ? '#3c4043' : '#ea4335',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={toggleCam}
          title={camOn ? 'Turn off camera' : 'Turn on camera'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: camOn ? '#3c4043' : '#ea4335',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          {camOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Toggle Screen Share */}
        <button
          onClick={toggleScreenShare}
          title={isSharingScreen ? 'Stop Presenting Screen' : 'Present / Share Screen'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: isSharingScreen ? '#8ab4f8' : '#3c4043',
            color: isSharingScreen ? '#202124' : '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          {isSharingScreen ? <MonitorStop size={20} /> : <Monitor size={20} />}
        </button>

        {/* Raise Hand */}
        <button
          onClick={toggleRaiseHand}
          title={handRaised ? 'Lower Hand' : 'Raise Hand'}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: handRaised ? '#f59e0b' : '#3c4043',
            color: handRaised ? '#000' : '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          <Hand size={20} />
        </button>

        {/* Record Meeting Button */}
        <button
          onClick={toggleMeetingRecording}
          title={isRecording ? 'Stop Recording & Save Video' : 'Record Meeting Video'}
          style={{
            height: '48px',
            padding: '0 20px',
            borderRadius: '24px',
            background: isRecording ? '#ef4444' : '#2d3748',
            color: '#fff',
            border: isRecording ? '2px solid #fca5a5' : '1px solid rgba(255,255,255,0.15)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isRecording ? '0 0 15px rgba(239, 68, 68, 0.6)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          {isRecording ? <Square size={16} fill="#ffffff" /> : <CircleDot size={18} color="#ef4444" />}
          <span>{isRecording ? `REC ${formatDuration(recTime)}` : 'Record Meeting'}</span>
        </button>

        {/* End / Leave Call Button */}
        <button
          onClick={onLeave}
          title="Leave Video Call"
          style={{
            height: '48px',
            padding: '0 24px',
            borderRadius: '24px',
            background: '#ea4335',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(234, 67, 53, 0.4)'
          }}
        >
          <PhoneOff size={18} />
          <span>Leave Call</span>
        </button>
      </div>
    </div>
  );
};
