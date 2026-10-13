import { spawn, ChildProcess } from 'child_process';
import os from 'os';

export class TunnelService {
  private static tunnelProcess: ChildProcess | null = null;
  private static publicUrl: string = '';
  private static isStarting: boolean = false;
  private static status: 'idle' | 'connecting' | 'connected' | 'error' = 'idle';

  public static startTunnel(): void {
    if (this.tunnelProcess || this.isStarting) {
      return;
    }

    this.isStarting = true;
    this.status = 'connecting';
    console.log('[TunnelService] ⚡ Starting automated Cloudflare Public Tunnel...');

    try {
      const isWin = os.platform() === 'win32';
      const command = isWin ? 'cmd.exe' : 'npx';
      const args = isWin
        ? ['/c', 'npx -y cloudflared tunnel --url http://localhost:3000']
        : ['-y', 'cloudflared', 'tunnel', '--url', 'http://localhost:3000'];

      this.tunnelProcess = spawn(command, args, {
        env: { ...process.env },
        detached: false
      });

      const parseOutput = (data: Buffer) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0]) {
          const url = match[0].trim();
          if (this.publicUrl !== url) {
            this.publicUrl = url;
            this.status = 'connected';
            this.isStarting = false;
            console.log(`=======================================================`);
            console.log(`🌐 Cloudflare Worldwide Public Tunnel Active:`);
            console.log(`👉 ${this.publicUrl}`);
            console.log(`=======================================================`);
          }
        }
      };

      if (this.tunnelProcess.stdout) {
        this.tunnelProcess.stdout.on('data', parseOutput);
      }

      if (this.tunnelProcess.stderr) {
        this.tunnelProcess.stderr.on('data', parseOutput);
      }

      this.tunnelProcess.on('error', (err) => {
        console.warn('[TunnelService Warning] Cloudflare tunnel process error:', err.message);
        this.status = 'error';
        this.isStarting = false;
      });

      this.tunnelProcess.on('exit', (code) => {
        console.log(`[TunnelService] Tunnel process exited with code ${code}.`);
        this.tunnelProcess = null;
        this.publicUrl = '';
        this.status = 'idle';
        this.isStarting = false;
      });
    } catch (err: any) {
      console.error('[TunnelService Error] Failed to launch cloudflared:', err.message);
      this.status = 'error';
      this.isStarting = false;
    }
  }

  public static getPublicUrl(): string {
    return this.publicUrl;
  }

  public static getStatus(): 'idle' | 'connecting' | 'connected' | 'error' {
    return this.status;
  }
}
