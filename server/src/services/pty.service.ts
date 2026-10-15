import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { FileService } from './file.service';

export interface PTYSession {
  id: string;
  workspaceId: string;
  workspaceName: string;
  buffer: string;
  onData: (data: string) => void;
  process: {
    write: (data: string) => void;
    kill: () => void;
  };
}

export class PTYService {
  private static sessions: Map<string, PTYSession> = new Map();

  /**
   * Sanitizes paths in terminal streams so that prompt and directory paths show the
   * project folder name (e.g. C:\Users\HP\room_cuv05s) exactly like in VS Code.
   */
  public static sanitizeOutput(text: string, workspaceName = 'demo'): string {
    if (!text) return text;
    const cleanWsName = (workspaceName || 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFolder = `C:\\Users\\HP\\${cleanWsName}`;
    return text
      .replace(/C:\\Users\\[^\\]+\\.gemini\\antigravity\\scratch\\nexforge\\workspaces_storage\\[a-f0-9-]+/gi, targetFolder)
      .replace(/C:[\\\/]Users[\\\/][^\\\/]+[\\\/]\.gemini[\\\/]antigravity[\\\/]scratch[\\\/]nexforge[\\\/]workspaces_storage[\\\/][a-f0-9-]+/gi, targetFolder)
      .replace(/C:[\\\/]Users[\\\/][^\\\/]+[\\\/]\.gemini[\\\/]antigravity[\\\/]scratch[\\\/]nexforge/gi, targetFolder)
      .replace(/\\\.gemini\\antigravity\\scratch\\nexforge/gi, `\\${cleanWsName}`)
      .replace(/\.gemini[\\\/]antigravity[\\\/]scratch/gi, 'Projects')
      .replace(/\.gemini[\\\/]antigravity/gi, 'NexForgeDev')
      .replace(/\/tmp\/workspaces_storage\/[a-f0-9-]+/gi, `~/${cleanWsName}`)
      .replace(/render@srv-[a-z0-9-]+/gi, 'nexforge@render');
  }

  /**
   * Retrieves an existing alive session or spawns a new one.
   * Never registers duplicate listeners or emits duplicated output.
   */
  public static getOrCreateSession(
    sessionId: string,
    workspaceId: string,
    workspaceName = 'demo',
    onData: (data: string) => void,
    isPrivate = false
  ): PTYSession {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      // Keep existing running process and ensure current room broadcaster is attached
      existing.onData = onData;
      // Replay existing buffered output so the terminal is never blank
      if (existing.buffer) {
        try {
          onData(existing.buffer);
        } catch (_) {}
      }
      // Trigger a prompt redraw in case the shell is idle at the command line
      try {
        existing.process.write('\r');
      } catch (_) {}
      return existing;
    }

    return this.createSession(sessionId, workspaceId, workspaceName, onData, isPrivate);
  }

  public static createSession(
    sessionId: string,
    workspaceId: string,
    workspaceName = 'demo',
    onData: (data: string) => void,
    isPrivate = false
  ): PTYSession {
    // If a session exists, cleanly kill and recreate
    this.killSession(sessionId);

    const workingDir = FileService.getWorkspaceDiskPath(workspaceId);
    const isWin = os.platform() === 'win32';
    const shell = isWin ? 'powershell.exe' : 'bash';
    const cleanWsName = (workspaceName || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');

    let currentSession: PTYSession;

    const broadcastData = (rawText: string) => {
      const sanitized = this.sanitizeOutput(rawText, cleanWsName);
      if (currentSession) {
        currentSession.buffer = ((currentSession.buffer || '') + sanitized).slice(-30000);
        if (currentSession.onData) {
          try {
            currentSession.onData(sanitized);
          } catch (_) {}
        }
      }
    };

    let procInstance: { write: (data: string) => void; kill: () => void };

    // Ensure pip config exists on Linux / Render to bypass PEP 668 externally-managed-environment error
    if (!isWin) {
      try {
        const homeDir = os.homedir();
        const pipConfDir = path.join(homeDir, '.config', 'pip');
        fs.ensureDirSync(pipConfDir);
        fs.writeFileSync(path.join(pipConfDir, 'pip.conf'), '[global]\nbreak-system-packages = true\n');

        const legacyPipDir = path.join(homeDir, '.pip');
        fs.ensureDirSync(legacyPipDir);
        fs.writeFileSync(path.join(legacyPipDir, 'pip.conf'), '[global]\nbreak-system-packages = true\n');
      } catch (err) {
        console.warn('[PTYService] Could not write pip.conf:', err);
      }
    }

    // Set PowerShell prompt to match VS Code with dynamic (venv) indicator & auto-activation upon creation
    const promptCommand = isPrivate
      ? `function global:prompt { if (-not $env:VIRTUAL_ENV) { if (Test-Path ".\\venv_private\\Scripts\\Activate.ps1") { & ".\\venv_private\\Scripts\\Activate.ps1" } }; $v = if ($env:VIRTUAL_ENV) { "($((Split-Path $env:VIRTUAL_ENV -Leaf))) " } else { "(private) " }; "$($v)PS C:\\Users\\HP\\${cleanWsName} [Private]> " }; function global:activate { if (Test-Path ".\\venv_private\\Scripts\\Activate.ps1") { & ".\\venv_private\\Scripts\\Activate.ps1" } else { Write-Host "No private virtual environment found. Create one with: python -m venv venv_private" -ForegroundColor Yellow } }; if (Test-Path ".\\venv_private\\Scripts\\Activate.ps1") { & ".\\venv_private\\Scripts\\Activate.ps1" }; Clear-Host`
      : `function global:prompt { if (-not $env:VIRTUAL_ENV) { if (Test-Path ".\\venv\\Scripts\\Activate.ps1") { & ".\\venv\\Scripts\\Activate.ps1" } elseif (Test-Path ".\\.venv\\Scripts\\Activate.ps1") { & ".\\.venv\\Scripts\\Activate.ps1" } }; $v = if ($env:VIRTUAL_ENV) { "($((Split-Path $env:VIRTUAL_ENV -Leaf))) " } else { "" }; "$($v)PS C:\\Users\\HP\\${cleanWsName}> " }; function global:activate { if (Test-Path ".\\venv\\Scripts\\Activate.ps1") { & ".\\venv\\Scripts\\Activate.ps1" } elseif (Test-Path ".\\.venv\\Scripts\\Activate.ps1") { & ".\\.venv\\Scripts\\Activate.ps1" } else { Write-Host "No virtual environment found. Create one with: python -m venv venv" -ForegroundColor Yellow } }; if (Test-Path ".\\venv\\Scripts\\Activate.ps1") { & ".\\venv\\Scripts\\Activate.ps1" } elseif (Test-Path ".\\.venv\\Scripts\\Activate.ps1") { & ".\\.venv\\Scripts\\Activate.ps1" }; Clear-Host`;

    let shellArgs: string[];
    if (isWin) {
      shellArgs = ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', promptCommand];
    } else {
      const rcFileName = isPrivate ? `.nexforge_bashrc_private_${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `.nexforge_bashrc_${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const rcFilePath = path.join(os.tmpdir(), rcFileName);
      try {
        const activateFunc = isPrivate
          ? `activate() { if [ -f "$NEXFORGE_WS/venv_private/bin/activate" ]; then source "$NEXFORGE_WS/venv_private/bin/activate"; elif [ -f "venv_private/bin/activate" ]; then source "venv_private/bin/activate"; else echo -e "\\033[33mNo private virtual environment found. Create one with: python3 -m venv venv_private\\033[0m"; fi; }`
          : `activate() { if [ -f "$NEXFORGE_WS/venv/bin/activate" ]; then source "$NEXFORGE_WS/venv/bin/activate"; elif [ -f "venv/bin/activate" ]; then source "venv/bin/activate"; elif [ -f ".venv/bin/activate" ]; then source ".venv/bin/activate"; elif [ -n "$1" ] && [ -f "$1/bin/activate" ]; then source "$1/bin/activate"; else echo -e "\\033[33mNo virtual environment found. Create one with: python3 -m venv venv\\033[0m"; fi; }`;

        const bashrcContent = [
          `[ -f /etc/bash.bashrc ] && . /etc/bash.bashrc`,
          `[ -f ~/.bashrc ] && . ~/.bashrc`,
          `unset VIRTUAL_ENV`,
          `unset CONDA_DEFAULT_ENV`,
          `unset CONDA_PREFIX`,
          `export NEXFORGE_WS="${workingDir}"`,
          `export VIRTUAL_ENV_DISABLE_PROMPT=1`,
          `export PIP_BREAK_SYSTEM_PACKAGES=1`,
          `export PATH="$HOME/.local/bin:$PATH"`,
          `if ! command -v python >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then alias python=python3; fi`,
          `if ! command -v pip >/dev/null 2>&1 && command -v pip3 >/dev/null 2>&1; then alias pip=pip3; fi`,
          activateFunc,
          `__nexforge_prompt() { if [ -n "$VIRTUAL_ENV" ] && [ -d "$VIRTUAL_ENV" ] && [[ "$VIRTUAL_ENV" == "$NEXFORGE_WS"* ]]; then echo -n "($(basename "$VIRTUAL_ENV")) "; fi; }`,
          `export PS1='\$(__nexforge_prompt)\\[\\033[01;32m\\]nexforge@render\\[\\033[00m\\]:\\[\\033[01;34m\\]~/${cleanWsName}\\[\\033[00m\\]\\$ '`,
          `clear`
        ].join('\n');

        fs.writeFileSync(rcFilePath, bashrcContent, 'utf-8');
      } catch (err) {
        console.warn('[PTYService] Could not write nexforge_bashrc:', err);
      }
      shellArgs = ['--rcfile', rcFilePath, '-i'];
    }

    const userLocalBin = !isWin ? `${path.join(os.homedir(), '.local', 'bin')}:` : '';
    const spawnEnv: Record<string, string> = {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      PIP_BREAK_SYSTEM_PACKAGES: '1',
      PIP_NO_WARN_SCRIPT_LOCATION: '0',
      PYTHONUNBUFFERED: '1',
      PATH: `${userLocalBin}${process.env.PATH || ''}`,
      PROMPT: isPrivate ? `(private) PS C:\\Users\\HP\\${cleanWsName} [Private]> ` : `PS C:\\Users\\HP\\${cleanWsName}> `
    } as Record<string, string>;

    // CRITICAL: Strip any inherited host/Render Python virtualenv so the workspace terminal does not show (.venv) unless created by the user!
    delete spawnEnv.VIRTUAL_ENV;
    delete spawnEnv.CONDA_DEFAULT_ENV;
    delete spawnEnv.CONDA_PREFIX;

    try {
      // Use real node-pty pseudoterminal (same as VS Code)
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 100,
        rows: 24,
        cwd: workingDir,
        env: spawnEnv,
        useConpty: false
      });

      ptyProcess.onData((data: string) => {
        broadcastData(data);
      });

      ptyProcess.onExit((event) => {
        console.log(`[PTYService] Process exited for session ${sessionId}:`, event);
        const current = this.sessions.get(sessionId);
        if (current && current.process === procInstance) {
          this.sessions.delete(sessionId);
          broadcastData(`\r\n\x1b[33m[Process exited with code ${event?.exitCode ?? 0}. Type any command or press Enter to restart]\x1b[0m\r\n`);
        }
      });

      procInstance = {
        write: (data: string) => ptyProcess.write(data),
        kill: () => {
          try {
            ptyProcess.kill();
          } catch (_) {}
        }
      };
    } catch (ptyErr) {
      console.warn('[PTYService] node-pty spawn failed, falling back to child_process:', ptyErr);
      const fallbackChild = spawn(shell, shellArgs, {
        cwd: workingDir,
        env: spawnEnv,
        shell: false
      });

      fallbackChild.stdout?.on('data', (chunk) => {
        broadcastData(chunk.toString('utf-8'));
      });

      fallbackChild.stderr?.on('data', (chunk) => {
        broadcastData(chunk.toString('utf-8'));
      });

      fallbackChild.on('close', (code) => {
        console.log(`[PTYService] fallbackChild closed for session ${sessionId}:`, code);
        const current = this.sessions.get(sessionId);
        if (current && current.process === procInstance) {
          this.sessions.delete(sessionId);
          broadcastData(`\r\n\x1b[33m[Process exited with code ${code}. Type any command or press Enter to restart]\x1b[0m\r\n`);
        }
      });

      procInstance = {
        write: (data: string) => fallbackChild.stdin?.write(data.replace(/\r(?!\n)/g, '\r\n')),
        kill: () => {
          try {
            fallbackChild.kill();
          } catch (_) {}
        }
      };
    }

    currentSession = {
      id: sessionId,
      workspaceId,
      workspaceName: cleanWsName,
      buffer: '',
      onData,
      process: procInstance
    };

    this.sessions.set(sessionId, currentSession);
    
    // Initial welcome banner matching the folder name in VS Code style
    const cleanDisplayPath = isWin ? `C:\\Users\\HP\\${cleanWsName}` : `/workspace/${cleanWsName}`;
    if (isPrivate) {
      broadcastData(`\r\n\x1b[35m=== NexForge Private Terminal (Isolated Session) ===\x1b[0m\r\n\x1b[90mSession: Private Isolated PTY | Working Directory: ${cleanDisplayPath}\x1b[0m\r\n\x1b[36mTip: Packages installed here (e.g. pip install pandas) are isolated to venv_private and do NOT affect teammates.\x1b[0m\r\n\r\n`);
    } else {
      broadcastData(`\r\n\x1b[32m=== NexForge Interactive Workspace PTY Terminal ===\x1b[0m\r\n\x1b[90mWorking Directory: ${cleanDisplayPath}\x1b[0m\r\n\r\n`);
    }

    return currentSession;
  }

  public static writeInput(
    sessionId: string,
    input: string,
    workspaceId?: string,
    workspaceName?: string,
    onDataFallback?: (data: string) => void,
    isPrivate = false
  ) {
    let session = this.sessions.get(sessionId);
    
    // Auto-resurrect session if it doesn't exist
    if (!session && (workspaceId || sessionId)) {
      const targetWsId = workspaceId || sessionId;
      console.log(`[PTYService] 🔄 Auto-creating session on input for ${sessionId} (isPrivate: ${isPrivate})`);
      session = this.createSession(sessionId, targetWsId, workspaceName || 'demo', onDataFallback || (() => {}), isPrivate);
    }

    if (session && session.process) {
      session.process.write(input);
    } else {
      console.warn(`[PTYService] ⚠️ Session ${sessionId} could not write input!`);
    }
  }

  public static killSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.process.kill();
      } catch (_) {}
      this.sessions.delete(sessionId);
    }
  }
}
