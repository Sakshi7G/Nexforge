import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest, requireWorkspaceMember } from '../middleware/auth';
import { GitService } from '../services/git.service';

const router = Router();
router.use(authenticateJWT);

// GET status
router.get('/:workspaceId/git/status', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const status = await GitService.getStatus(workspaceId);
    const remoteUrl = await GitService.getRemoteUrl(workspaceId);
    res.json({ status: { ...status, remoteUrl } });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch git status', details: error.message });
  }
});

// POST init
router.post('/:workspaceId/git/init', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const message = await GitService.initRepo(workspaceId);
    res.json({ message });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to initialize git repository', details: error.message });
  }
});

// POST stage file or all
router.post('/:workspaceId/git/stage', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { filePath } = req.body;
    await GitService.stageFile(workspaceId, filePath);
    res.json({ success: true, message: filePath ? `Staged ${filePath}` : 'Staged all files' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to stage changes', details: error.message });
  }
});

// POST unstage file or all
router.post('/:workspaceId/git/unstage', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { filePath } = req.body;
    await GitService.unstageFile(workspaceId, filePath);
    res.json({ success: true, message: filePath ? `Unstaged ${filePath}` : 'Unstaged all files' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to unstage changes', details: error.message });
  }
});

// POST commit
router.post('/:workspaceId/git/commit', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message is required' });

    const result = await GitService.commitChanges(workspaceId, message, req.user?.name);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to commit changes', details: error.message });
  }
});

// POST set remote URL
router.post('/:workspaceId/git/remote', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Remote URL is required' });

    const remoteUrl = await GitService.setRemoteUrl(workspaceId, url);
    res.json({ success: true, remoteUrl });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to configure remote repository URL', details: error.message });
  }
});

// POST push
router.post('/:workspaceId/git/push', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { branch, force } = req.body;
    const message = await GitService.push(workspaceId, branch, force);
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to push to GitHub remote', details: error.message });
  }
});

// POST pull
router.post('/:workspaceId/git/pull', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { branch, force } = req.body;
    const message = await GitService.pull(workspaceId, branch, force);

    // Notify all clients in the workspace room that files have changed
    const io = req.app.get('io');
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('filetree:mutation');
    }

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to pull from GitHub remote', details: error.message });
  }
});

// GET branches
router.get('/:workspaceId/git/branches', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const branchInfo = await GitService.getBranches(workspaceId);
    res.json({ branchInfo });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch branches', details: error.message });
  }
});

// POST checkout / create branch
router.post('/:workspaceId/git/checkout', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { branchName, createNew } = req.body;
    if (!branchName) return res.status(400).json({ error: 'Branch name is required' });

    const activeBranch = await GitService.checkoutBranch(workspaceId, branchName, Boolean(createNew));
    res.json({ success: true, activeBranch });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to switch branch', details: error.message });
  }
});

// GET log
router.get('/:workspaceId/git/log', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const history = await GitService.getHistory(workspaceId);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch git log', details: error.message });
  }
});

// GET diff
router.get('/:workspaceId/git/diff', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { filePath } = req.query;
    const diff = await GitService.getDiff(workspaceId, filePath as string);
    res.json({ diff });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch git diff', details: error.message });
  }
});

export default router;
