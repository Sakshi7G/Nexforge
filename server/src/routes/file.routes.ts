import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest, requireWorkspaceMember } from '../middleware/auth';
import { FileService } from '../services/file.service';

const router = Router();
router.use(authenticateJWT);

// GET /api/workspaces/:workspaceId/files (Get file tree)
router.get('/:workspaceId/files', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const tree = await FileService.getFileTree(workspaceId);
    res.json({ files: tree });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch file tree', details: error.message });
  }
});

// POST /api/workspaces/:workspaceId/files (Create file or folder)
router.post('/:workspaceId/files', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { path, isFolder, content } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const created = await FileService.createFileOrFolder(workspaceId, path, isFolder ?? false, content);
    res.status(201).json({ file: created });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create file/folder', details: error.message });
  }
});

// PUT /api/workspaces/:workspaceId/files/content (Save content)
router.put('/:workspaceId/files/content', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { path, content } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const updated = await FileService.updateFileContent(workspaceId, path, content ?? '');
    res.json({ file: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update file content', details: error.message });
  }
});

// PUT /api/workspaces/:workspaceId/files/rename (Rename or Move)
router.put('/:workspaceId/files/rename', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { oldPath, newPath } = req.body;

    if (!oldPath || !newPath) {
      return res.status(400).json({ error: 'oldPath and newPath are required' });
    }

    const updated = await FileService.renameOrMove(workspaceId, oldPath, newPath);
    res.json({ file: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to rename/move file', details: error.message });
  }
});

// DELETE /api/workspaces/:workspaceId/files (Delete file or folder)
router.delete('/:workspaceId/files', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    await FileService.deleteFileOrFolder(workspaceId, path);
    res.json({ success: true, message: `Deleted ${path}` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

export default router;
