import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeToggle } from '../Common/ThemeToggle';
import { Code2, Sparkles, Video, Edit3, MessageSquare, Play, ArrowRight, Users, Terminal, Bot, Layers, LogOut } from 'lucide-react';

interface LandingPageProps {
  onStartSession: () => void;
  onOpenAuth: () => void;
  user: any;
  onLogout?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartSession, onOpenAuth, user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      overflowY: 'auto'
    }}>
      {/* Top Navigation Bar */}
      <nav className="glass-panel" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 36px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-gradient-glow)'
          }}>
            <Code2 size={20} color="#fff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '22px' }} className="gradient-text">
              NexForge
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-tertiary)',
              color: 'var(--accent-primary)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}>
              v1.0
            </span>
          </div>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: '28px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
          <a href="#ai" style={{ color: 'inherit', textDecoration: 'none' }}>Gemini AI</a>
          <a href="#stack" style={{ color: 'inherit', textDecoration: 'none' }}>Tech Stack</a>
          <a href="#workflow" style={{ color: 'inherit', textDecoration: 'none' }}>Workflow</a>
        </div>

        {/* Theme Toggle & CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle variant="full" />

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                fontWeight: 500
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '10px'
                }}>
                  {(user?.name || 'User').slice(0, 2).toUpperCase()}
                </div>
                <span>{user?.name}</span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Log Out"
                >
                  <LogOut size={14} /> Log Out
                </button>
              )}
              <button onClick={onStartSession} className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                <Play size={15} /> Open Studio
              </button>
            </div>
          ) : (
            <>
              <button onClick={onOpenAuth} className="btn-secondary">
                Sign In
              </button>
              <button onClick={onStartSession} className="btn-primary" style={{ padding: '10px 20px', fontSize: '15px' }}>
                Start Session <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '80px 24px 60px 24px',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: 'var(--accent-primary)',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '24px'
        }}>
          <Sparkles size={14} /> Real-Time Collaborative IDE powered by Google Gemini AI
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '56px',
          fontWeight: 800,
          lineHeight: '1.15',
          marginBottom: '20px',
          letterSpacing: '-1px',
          color: 'var(--text-primary)'
        }}>
          One workspace. <br />
          <span className="gradient-text">Every tool your team pretends to use.</span>
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          maxWidth: '780px',
          margin: '0 auto 40px auto',
          lineHeight: '1.6'
        }}>
          NexForge collapses VS Code, Zoom, Whiteboard, Docs, and Gemini AI into a single real-time room. Code together, talk face-to-face, whiteboard architecture, and let AI ship code without switching tabs.
        </p>

        {/* Hero Main CTA: Start Session Button */}
        <div style={{ marginBottom: '60px' }}>
          <button
            onClick={onStartSession}
            className="btn-primary"
            style={{
              padding: '16px 36px',
              fontSize: '18px',
              fontWeight: 700,
              borderRadius: '12px',
              boxShadow: 'var(--accent-gradient-glow)'
            }}
          >
            Start Session Now <ArrowRight size={22} />
          </button>
          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>✓ Zero Setup Required</span>
            <span>✦ Shareable Link</span>
            <span>★ Admin, Editor & Viewer Roles</span>
          </div>
        </div>

        {/* Code Preview Card */}
        <div className="glass-panel" style={{
          maxWidth: '920px',
          margin: '0 auto',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          textAlign: 'left'
        }}>
          {/* Header */}
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
            </div>

            <div style={{ fontSize: '12px', fontFamily: "'Fira Code', monospace", color: 'var(--text-muted)', fontWeight: 500 }}>
              room_nexforge_live • TypeScript & Node.js Engine
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-success)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                ● 3 Active Teammates Connected
              </span>
            </div>
          </div>

          {/* Code Body */}
          <pre style={{
            padding: '24px',
            margin: 0,
            fontSize: '14px',
            fontFamily: "'Fira Code', monospace",
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            background: 'var(--bg-secondary)'
          }}>
            <code>{`import { createNexForgeRoom } from "@nexforge/core";

export async function launchCollaborativeRoom() {
  const room = await createNexForgeRoom({
    name: "payments-refactor-service",
    aiAssistant: "gemini-1.5-flash",
    features: {
      crdtRealtimeSync: true,
      webRtcVideoCall: true,
      whiteboardCanvas: true,
      ptyInteractiveTerminal: true
    }
  });

  console.log(\`🚀 NexForge Room launched with ID: \${room.id}\`);
  return room;
}`}</code>
          </pre>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '70px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
            Built for how modern remote teams <span className="gradient-text">actually ship software</span>.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Eliminate tab fatigue. Code, call, whiteboard, and debug in one unified workspace.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {[
            { icon: Code2, title: 'Real-Time Multi-Cursor Editing', desc: 'Multiple developers editing the same file simultaneously. Live cursors, user color badges, and CRDT sync.' },
            { icon: Users, title: 'Rooms by ID & Share Links', desc: 'Spin up a workspace in 1 click. Copy direct room links to invite team members as Owner/Admin, Editor, or Viewer.' },
            { icon: Terminal, title: 'Docker Execution Sandbox', desc: 'Run code safely inside resource-capped Docker containers across JavaScript, Python, C++, Go, and Rust with stdout/stderr streams.' },
            { icon: Video, title: 'WebRTC Video & Voice Calls', desc: 'Peer-to-peer WebRTC video calling side-by-side with your code editor. Toggle mic and camera effortlessly.' },
            { icon: Edit3, title: 'Synced Canvas Whiteboard', desc: 'Real-time vector whiteboard for architecture diagrams, UML sketches, pen/shapes/text tools, and state persistence.' },
            { icon: MessageSquare, title: 'Workspace Team Chat', desc: 'Persistent workspace chat with typing indicators, markdown formatting, and member presence status.' }
          ].map((f, idx) => {
            const Icon = f.icon;
            return (
              <div key={idx} className="glass-panel" style={{
                padding: '28px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  color: 'var(--accent-primary)'
                }}>
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Assistant Section */}
      <section id="ai" style={{
        background: 'var(--bg-tertiary)',
        padding: '80px 24px',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
              <Bot size={16} /> POWERED BY GOOGLE GEMINI 1.5/2.0
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '38px', fontWeight: 700, marginBottom: '16px' }}>
              A senior engineer in the room, <span className="gradient-text">always.</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '700px', margin: '0 auto' }}>
              NexForge Gemini AI reads your workspace files, parses stack traces, and pairs with your whole team.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {[
              '✓ Contextual AI Chat aware of open files & terminal logs',
              '✓ AI Debugger: Stack trace analyzer & 1-click diff patcher',
              '✓ Inline Code Explanation in plain developer language',
              '✓ AI Code Review for security, bugs, & performance',
              '✓ Automated Unit Test Generator (Jest, PyTest, GoogleTest)',
              '✓ AI Git Commit Message Generator from git diffs'
            ].map((item, idx) => (
              <div key={idx} className="glass-panel" style={{
                padding: '20px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full-Stack Tech Stack Section */}
      <section id="stack" style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-secondary)', fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>
            <Layers size={16} /> FULL-STACK ARCHITECTURE
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 700 }}>
            Proven stack. <span className="gradient-text">Enterprise real-time engineering.</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '8px' }}>
            The exact technologies powering NexForge IDE end-to-end.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px'
        }}>
          {[
            { category: 'Frontend Studio', items: ['Vite + React 18 (TypeScript)', 'Monaco Editor (VS Code Engine)', 'Xterm.js Interactive Terminal', 'HTML5 Canvas Whiteboard', 'WebRTC Video Grid'] },
            { category: 'Backend Engine', items: ['Node.js + Express Framework', 'Socket.IO Real-Time Gateway', 'Prisma ORM Database Access', 'SQLite Database Storage', 'JWT Token Authentication'] },
            { category: 'Execution & PTY', items: ['Dockerode Sandbox Runner', 'Container CPU/Memory Caps', 'Node-PTY Terminal Handler', 'Simple-Git Version Control', 'Disk Mirror File System'] },
            { category: 'AI Intelligence', items: ['Google Gemini API Integration', 'Contextual Code Prompts', 'Automated Stack Trace Parser', 'Diff Patch Proposal Engine', 'AI Commit Generator'] }
          ].map((col, idx) => (
            <div key={idx} className="glass-panel" style={{
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '14px' }}>
                {col.category}
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {col.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" style={{
        background: 'var(--bg-tertiary)',
        padding: '70px 24px',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 700, marginBottom: '40px' }}>
            From "let's hop on a call" to shipped — in <span className="gradient-text">one room</span>.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            textAlign: 'left'
          }}>
            {[
              { step: '01', title: 'Spin Up Room', desc: 'Click Start Session to configure your room.' },
              { step: '02', title: 'Share Room ID', desc: 'Copy direct share link to invite teammates.' },
              { step: '03', title: 'Code & Call Live', desc: 'Edit code, video-call, whiteboard & chat in 1 tab.' },
              { step: '04', title: 'AI Ships Fixes', desc: 'Gemini writes tests, fixes bugs & generates commits.' }
            ].map((s, idx) => (
              <div key={idx} className="glass-panel" style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                  STEP {s.step}
                </div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>{s.title}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '13px',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div>NexForge © 2026. Built with React, TypeScript, Monaco, Socket.IO, Docker & Gemini AI.</div>
        <div>
          <a href="#top" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
};
