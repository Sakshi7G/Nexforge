import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { AuthRequest, authenticateJWT, requireWorkspaceMember } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// GET /api/workspaces/:workspaceId/notes - List all notes in a workspace
router.get('/:workspaceId/notes', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const notes = await prisma.note.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json({ notes });
  } catch (err: any) {
    console.error('[Get Notes Error]', err);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/workspaces/:workspaceId/notes - Create a new note
router.post('/:workspaceId/notes', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { title, content } = req.body;

    const note = await prisma.note.create({
      data: {
        workspaceId,
        title: title?.trim() || 'Untitled Note',
        content: content || '',
        authorId: req.user?.id
      }
    });

    return res.status(201).json({ note });
  } catch (err: any) {
    console.error('[Create Note Error]', err);
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/workspaces/:workspaceId/notes/:noteId - Update a note's title or content
router.put('/:workspaceId/notes/:noteId', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, noteId } = req.params;
    const { title, content } = req.body;

    const existingNote = await prisma.note.findFirst({
      where: { id: noteId, workspaceId }
    });
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(title !== undefined && { title: title.trim() || 'Untitled Note' }),
        ...(content !== undefined && { content })
      }
    });

    return res.json({ note: updatedNote });
  } catch (err: any) {
    console.error('[Update Note Error]', err);
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/workspaces/:workspaceId/notes/:noteId - Delete a note
router.delete('/:workspaceId/notes/:noteId', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, noteId } = req.params;

    const existingNote = await prisma.note.findFirst({
      where: { id: noteId, workspaceId }
    });
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await prisma.note.delete({
      where: { id: noteId }
    });

    return res.json({ message: 'Note deleted successfully', noteId });
  } catch (err: any) {
    console.error('[Delete Note Error]', err);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
