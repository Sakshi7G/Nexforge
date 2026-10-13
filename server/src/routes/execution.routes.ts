import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest, requireWorkspaceMember } from '../middleware/auth';
import { DockerExecutionService } from '../services/docker.service';

const router = Router();
router.use(authenticateJWT);

// POST /api/workspaces/:workspaceId/execute
router.post('/:workspaceId/execute', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { entryFile, language } = req.body;

    if (!entryFile) {
      return res.status(400).json({ error: 'Entry file path is required' });
    }

    const result = await DockerExecutionService.executeCode({
      workspaceId,
      entryFile,
      language: language || 'javascript'
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Execution failed', details: error.message });
  }
});

export default router;
