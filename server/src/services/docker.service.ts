import Docker from 'dockerode';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { FileService } from './file.service';

const docker = new Docker();

export interface ExecutionOptions {
  workspaceId: string;
  entryFile: string;
  language?: string;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

function inferLanguage(entryFile: string, defaultLanguage?: string): string {
  const ext = entryFile.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'cpp':
    case 'c':
    case 'cc':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    default:
      return defaultLanguage || 'javascript';
  }
}

export class DockerExecutionService {
  private static isDockerAvailable = false;

  public static async checkDockerAvailability(): Promise<boolean> {
    try {
      await docker.ping();
      this.isDockerAvailable = true;
      console.log('[DockerExecutionService] Docker daemon connected successfully.');
      return true;
    } catch (err) {
      this.isDockerAvailable = false;
      console.log('[DockerExecutionService] Docker daemon not reachable. Falling back to isolated process runner.');
      return false;
    }
  }

  public static async executeCode(options: ExecutionOptions): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const diskPath = FileService.getWorkspaceDiskPath(options.workspaceId);
    const entryFilePath = path.join(diskPath, options.entryFile);

    if (!await fs.pathExists(entryFilePath)) {
      throw new Error(`Entry file '${options.entryFile}' does not exist on disk.`);
    }

    const effectiveLanguage = inferLanguage(options.entryFile, options.language);
    console.log(`[ExecutionService] Executing '${options.entryFile}' with language engine: '${effectiveLanguage}'`);

    const hasDocker = await this.checkDockerAvailability();

    if (hasDocker) {
      return this.runInDockerContainer({ ...options, language: effectiveLanguage }, diskPath);
    } else {
      return this.runInProcessSandbox({ ...options, language: effectiveLanguage }, diskPath);
    }
  }

  private static async runInDockerContainer(options: ExecutionOptions, hostPath: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    let image = 'node:18-alpine';
    let cmd: string[] = ['node', options.entryFile];
    const lang = (options.language || 'javascript').toLowerCase();

    switch (lang) {
      case 'python':
        image = 'python:3.10-alpine';
        cmd = ['python3', options.entryFile];
        break;
      case 'cpp':
        image = 'gcc:latest';
        cmd = ['sh', '-c', `g++ ${options.entryFile} -o /tmp/app && /tmp/app`];
        break;
      case 'go':
        image = 'golang:1.20-alpine';
        cmd = ['go', 'run', options.entryFile];
        break;
      case 'rust':
        image = 'rust:1.70-alpine';
        cmd = ['sh', '-c', `rustc ${options.entryFile} -o /tmp/app && /tmp/app`];
        break;
      default:
        image = 'node:18-alpine';
        cmd = ['node', options.entryFile];
        break;
    }

    let stdoutAcc = '';
    let stderrAcc = '';

    try {
      const container = await docker.createContainer({
        Image: image,
        Cmd: cmd,
        WorkingDir: '/workspace',
        HostConfig: {
          Binds: [`${hostPath}:/workspace:ro`],
          Memory: 256 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
          NetworkMode: 'none'
        },
        Tty: false
      });

      await container.start();

      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true
      });

      stream.on('data', (chunk: Buffer) => {
        const str = chunk.toString('utf-8');
        stdoutAcc += str;
        if (options.onStdout) options.onStdout(str);
      });

      const timeout = setTimeout(async () => {
        try {
          await container.kill();
        } catch (_) {}
      }, 15000);

      const status = await container.wait();
      clearTimeout(timeout);
      await container.remove();

      return {
        exitCode: status.StatusCode || 0,
        stdout: stdoutAcc,
        stderr: stderrAcc
      };
    } catch (err: any) {
      console.error('[DockerExecutionService Error]', err);
      const errMsg = `Container Execution Error: ${err.message}`;
      if (options.onStderr) options.onStderr(errMsg);
      return { exitCode: 1, stdout: stdoutAcc, stderr: errMsg };
    }
  }

  private static runInProcessSandbox(options: ExecutionOptions, workingDir: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let command = 'node';
      let args = [options.entryFile];
      const lang = (options.language || 'javascript').toLowerCase();

      switch (lang) {
        case 'python': {
          const venvPyWin = path.join(workingDir, 'venv', 'Scripts', 'python.exe');
          const venvPyUnix = path.join(workingDir, 'venv', 'bin', 'python');
          const dotVenvPyWin = path.join(workingDir, '.venv', 'Scripts', 'python.exe');
          const dotVenvPyUnix = path.join(workingDir, '.venv', 'bin', 'python');

          if (fs.existsSync(venvPyWin)) {
            command = `"${venvPyWin}"`;
          } else if (fs.existsSync(dotVenvPyWin)) {
            command = `"${dotVenvPyWin}"`;
          } else if (fs.existsSync(venvPyUnix)) {
            command = venvPyUnix;
          } else if (fs.existsSync(dotVenvPyUnix)) {
            command = dotVenvPyUnix;
          } else {
            command = os.platform() === 'win32' ? 'python' : 'python3';
          }
          args = [options.entryFile];
          break;
        }
        case 'cpp':
          command = 'cmd.exe';
          args = ['/c', `g++ ${options.entryFile} -o runner.exe && runner.exe`];
          break;
        case 'go':
          command = 'go';
          args = ['run', options.entryFile];
          break;
        default:
          command = 'node';
          args = [options.entryFile];
          break;
      }

      let stdoutAcc = '';
      let stderrAcc = '';

      const userLocalBin = os.platform() !== 'win32' ? `${path.join(os.homedir(), '.local', 'bin')}:` : '';
      const child = spawn(command, args, {
        cwd: workingDir,
        shell: true,
        env: {
          ...process.env,
          PIP_BREAK_SYSTEM_PACKAGES: '1',
          PATH: `${userLocalBin}${process.env.PATH || ''}`
        }
      });

      const timer = setTimeout(() => {
        child.kill();
        stderrAcc += '\n[Process timed out after 15 seconds]\n';
        if (options.onStderr) options.onStderr('\n[Process timed out after 15 seconds]\n');
      }, 15000);

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdoutAcc += text;
        if (options.onStdout) options.onStdout(text);
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderrAcc += text;
        if (options.onStderr) options.onStderr(text);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code || 0,
          stdout: stdoutAcc,
          stderr: stderrAcc
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const msg = `Execution process error: ${err.message}`;
        stderrAcc += msg;
        if (options.onStderr) options.onStderr(msg);
        resolve({ exitCode: 1, stdout: stdoutAcc, stderr: stderrAcc });
      });
    });
  }
}
