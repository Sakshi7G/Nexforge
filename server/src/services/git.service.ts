import simpleGit, { SimpleGit } from 'simple-git';
import { FileService } from './file.service';
import fs from 'fs-extra';
import path from 'path';

export class GitService {
  private static getGitInstance(workspaceId: string): SimpleGit {
    const diskPath = FileService.getWorkspaceDiskPath(workspaceId);
    return simpleGit(diskPath);
  }

  public static async initRepo(workspaceId: string): Promise<string> {
    const git = this.getGitInstance(workspaceId);
    const diskPath = FileService.getWorkspaceDiskPath(workspaceId);
    
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      await git.init();
      const gitignorePath = path.join(diskPath, '.gitignore');
      if (!await fs.pathExists(gitignorePath)) {
        await fs.writeFile(gitignorePath, 'node_modules/\n*.log\n.env\ndist/\n', 'utf-8');
      }
      return 'Initialized empty Git repository';
    }
    return 'Git repository already initialized';
  }

  public static async getStatus(workspaceId: string) {
    const git = this.getGitInstance(workspaceId);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return { isRepo: false, currentBranch: '', files: [] };
    }
    const status = await git.status();
    return {
      isRepo: true,
      currentBranch: status.current || 'main',
      staged: status.staged,
      modified: status.modified,
      not_added: status.not_added,
      deleted: status.deleted,
      files: status.files
    };
  }

  public static async stageFile(workspaceId: string, filePath?: string): Promise<void> {
    const git = this.getGitInstance(workspaceId);
    await this.initRepo(workspaceId);
    if (filePath) {
      await git.add(filePath);
    } else {
      await git.add('./*');
    }
  }

  public static async unstageFile(workspaceId: string, filePath?: string): Promise<void> {
    const git = this.getGitInstance(workspaceId);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return;
    if (filePath) {
      await git.reset(['HEAD', filePath]);
    } else {
      await git.reset(['HEAD']);
    }
  }

  public static async commitChanges(workspaceId: string, message: string, authorName?: string): Promise<any> {
    const git = this.getGitInstance(workspaceId);
    await this.initRepo(workspaceId);
    const status = await git.status();
    // If no staged files exist, stage all modifications before committing
    if (status.staged.length === 0) {
      await git.add('./*');
    }
    const result = await git.commit(message);
    return result;
  }

  public static async getRemoteUrl(workspaceId: string): Promise<string | null> {
    const git = this.getGitInstance(workspaceId);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;
    try {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      return origin?.refs.fetch || origin?.refs.push || null;
    } catch (err) {
      return null;
    }
  }

  public static async setRemoteUrl(workspaceId: string, url: string): Promise<string> {
    const git = this.getGitInstance(workspaceId);
    await this.initRepo(workspaceId);
    const cleanUrl = url.trim();
    try {
      const remotes = await git.getRemotes();
      const originExists = remotes.some(r => r.name === 'origin');
      if (originExists) {
        await git.remote(['set-url', 'origin', cleanUrl]);
      } else {
        await git.addRemote('origin', cleanUrl);
      }
      return cleanUrl;
    } catch (err: any) {
      throw new Error(`Failed to configure remote URL: ${err.message}`);
    }
  }

  public static async push(workspaceId: string, branch?: string, force = false): Promise<string> {
    const git = this.getGitInstance(workspaceId);
    const status = await git.status();
    const currentBranch = branch || status.current || 'main';
    try {
      const options = ['-u'];
      if (force) options.push('-f');
      await git.push('origin', currentBranch, options);
      return `Pushed changes successfully to origin/${currentBranch}`;
    } catch (err: any) {
      throw new Error(`Git Push failed: ${err.message}`);
    }
  }

  public static async pull(workspaceId: string, branch?: string, force = false): Promise<string> {
    const git = this.getGitInstance(workspaceId);
    await this.initRepo(workspaceId);

    // Verify remote exists
    const remotes = await git.getRemotes();
    const hasOrigin = remotes.some(r => r.name === 'origin');
    if (!hasOrigin) {
      throw new Error("No remote origin configured. Click 'Connect Remote' first to set your GitHub repository URL.");
    }

    // Configure pull.rebase = false to avoid fatal divergent branch errors
    await git.addConfig('pull.rebase', 'false').catch(() => {});

    // Ensure user identity is configured so merge commits never abort
    const userName = await git.raw(['config', 'user.name']).catch(() => '');
    if (!userName.trim()) {
      await git.raw(['config', 'user.name', 'NexForge Developer']).catch(() => {});
    }
    const userEmail = await git.raw(['config', 'user.email']).catch(() => '');
    if (!userEmail.trim()) {
      await git.raw(['config', 'user.email', 'developer@nexforge.dev']).catch(() => {});
    }

    try {
      // Fetch latest references from remote origin
      await git.fetch('origin');
    } catch (fetchErr: any) {
      const msg = fetchErr.message || '';
      if (msg.includes('Authentication failed') || msg.includes('could not read Username') || msg.includes('403')) {
        throw new Error('GitHub authentication failed. If this is a private repository, please include your GitHub Personal Access Token in the URL (e.g. https://<TOKEN>@github.com/user/repo.git).');
      }
      throw new Error(`Failed to fetch from GitHub: ${fetchErr.message}`);
    }

    // Detect available remote branches
    const remoteBranches = await git.branch(['-r']);
    const status = await git.status();
    let currentBranch = branch || status.current || 'main';

    // Normalize and find best remote branch to pull from
    const remoteNames = remoteBranches.all
      .map(b => b.trim().replace(/^origin\//, ''))
      .filter(b => b && !b.startsWith('HEAD'));

    let remoteBranchToUse = currentBranch;
    if (!remoteNames.includes(currentBranch)) {
      if (remoteNames.includes('main')) {
        remoteBranchToUse = 'main';
      } else if (remoteNames.includes('master')) {
        remoteBranchToUse = 'master';
      } else if (remoteNames.length > 0) {
        remoteBranchToUse = remoteNames[0];
      }
    }

    try {
      // Check if local branch has any commits yet (unborn HEAD in brand-new repo)
      const countStr = await git.raw(['rev-list', '--count', 'HEAD']).catch(() => '0');
      const hasCommits = parseInt(countStr.trim(), 10) > 0;

      if (!hasCommits || force) {
        // If repo has 0 commits or user requested Force Pull, checkout -f or reset to origin branch
        if (!hasCommits) {
          await git.raw(['checkout', '-f', '-B', remoteBranchToUse, `origin/${remoteBranchToUse}`]);
        } else {
          await git.raw(['reset', '--hard', `origin/${remoteBranchToUse}`]);
          await git.raw(['clean', '-fd']).catch(() => {});
        }
        await FileService.syncDiskToDb(workspaceId);
        return `Pulled and synchronized repository cleanly from origin/${remoteBranchToUse}`;
      }

      // Check if working tree has uncommitted modifications
      const isDirty = status.modified.length > 0 || status.staged.length > 0 || status.not_added.length > 0;
      let stashed = false;

      if (isDirty) {
        try {
          await git.stash(['push', '--include-untracked', '-m', 'nexforge-auto-stash']);
          stashed = true;
        } catch (_) {}
      }

      try {
        // Pull with merge resolution options
        const pullOptions = ['--allow-unrelated-histories', '--no-rebase'];
        await git.pull('origin', remoteBranchToUse, pullOptions);

        // Restore stashed local work if applicable
        if (stashed) {
          try {
            await git.stash(['pop']);
          } catch (stashPopErr) {
            console.warn('[GitService] Stash pop notice:', stashPopErr);
          }
        }
      } catch (pullErr: any) {
        // Abort merge on error so the repo isn't left in a locked / conflicted state
        await git.raw(['merge', '--abort']).catch(() => {});
        if (stashed) {
          await git.stash(['pop']).catch(() => {});
        }

        const msg = pullErr.message || '';
        if (msg.includes('conflict') || msg.includes('overwritten') || msg.includes('unrelated histories') || msg.includes('aborting')) {
          throw new Error(
            `Merge conflict with origin/${remoteBranchToUse}. Your local files conflict with incoming changes. Please commit your work or use Force Pull to overwrite local workspace with GitHub.`
          );
        }
        throw pullErr;
      }

      // Crucial: Synchronize updated disk files into database so Monaco Editor & File Explorer immediately show them
      await FileService.syncDiskToDb(workspaceId);

      return `Pulled latest changes successfully from origin/${remoteBranchToUse}`;
    } catch (err: any) {
      throw new Error(`Git Pull failed: ${err.message}`);
    }
  }

  public static async getBranches(workspaceId: string) {
    const git = this.getGitInstance(workspaceId);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return { current: 'main', branches: ['main'] };
    try {
      const branches = await git.branchLocal();
      return {
        current: branches.current || 'main',
        branches: branches.all.length > 0 ? branches.all : ['main']
      };
    } catch (err) {
      return { current: 'main', branches: ['main'] };
    }
  }

  public static async checkoutBranch(workspaceId: string, branchName: string, createNew = false): Promise<string> {
    const git = this.getGitInstance(workspaceId);
    await this.initRepo(workspaceId);
    const cleanBranch = branchName.trim();
    try {
      if (createNew) {
        await git.checkoutLocalBranch(cleanBranch);
      } else {
        await git.checkout(cleanBranch);
      }
      return cleanBranch;
    } catch (err: any) {
      throw new Error(`Failed to checkout branch "${cleanBranch}": ${err.message}`);
    }
  }

  public static async getHistory(workspaceId: string, limit = 20) {
    const git = this.getGitInstance(workspaceId);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return [];
    try {
      const log = await git.log({ maxCount: limit });
      return log.all;
    } catch (err) {
      return [];
    }
  }

  public static async getDiff(workspaceId: string, filePath?: string) {
    const git = this.getGitInstance(workspaceId);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return '';
    try {
      if (filePath) {
        const unstaged = await git.diff([filePath]);
        if (unstaged && unstaged.trim()) return unstaged;
        const staged = await git.diff(['--staged', filePath]);
        return staged;
      }

      // Check staged diff first
      const stagedDiff = await git.diff(['--staged']);
      if (stagedDiff && stagedDiff.trim()) {
        return stagedDiff;
      }

      // Fallback to unstaged diff
      const unstagedDiff = await git.diff();
      if (unstagedDiff && unstagedDiff.trim()) {
        return unstagedDiff;
      }

      // Fallback to git status summary
      const status = await git.status();
      if (status.files.length > 0) {
        return status.files.map(f => `${f.index || 'M'} ${f.path}`).join('\n');
      }

      return 'Workspace files updated';
    } catch (err) {
      return 'Workspace files modified';
    }
  }
}
