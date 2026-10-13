import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { AuthRequest, authenticateJWT, requireWorkspaceMember } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// GET /api/workspaces/:workspaceId/sheets - List all spreadsheets
router.get('/:workspaceId/sheets', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const sheets = await prisma.spreadsheet.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json({ sheets });
  } catch (err: any) {
    console.error('[Get Sheets Error]', err);
    return res.status(500).json({ error: 'Failed to fetch spreadsheets' });
  }
});

// POST /api/workspaces/:workspaceId/sheets - Create a new spreadsheet
router.post('/:workspaceId/sheets', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { title, dataJson } = req.body;

    const defaultData = dataJson || JSON.stringify([
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', '']
    ]);

    const sheet = await prisma.spreadsheet.create({
      data: {
        workspaceId,
        title: title?.trim() || 'Untitled Sheet.xlsx',
        dataJson: defaultData,
        authorId: req.user?.id
      }
    });

    return res.status(201).json({ sheet });
  } catch (err: any) {
    console.error('[Create Sheet Error]', err);
    return res.status(500).json({ error: 'Failed to create spreadsheet' });
  }
});

// PUT /api/workspaces/:workspaceId/sheets/:sheetId - Update a sheet
router.put('/:workspaceId/sheets/:sheetId', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, sheetId } = req.params;
    const { title, dataJson } = req.body;

    const existingSheet = await prisma.spreadsheet.findFirst({
      where: { id: sheetId, workspaceId }
    });
    if (!existingSheet) {
      return res.status(404).json({ error: 'Spreadsheet not found' });
    }

    const updatedSheet = await prisma.spreadsheet.update({
      where: { id: sheetId },
      data: {
        ...(title !== undefined && { title: title.trim() || 'Untitled Sheet.xlsx' }),
        ...(dataJson !== undefined && { dataJson })
      }
    });

    return res.json({ sheet: updatedSheet });
  } catch (err: any) {
    console.error('[Update Sheet Error]', err);
    return res.status(500).json({ error: 'Failed to update spreadsheet' });
  }
});

// DELETE /api/workspaces/:workspaceId/sheets/:sheetId - Delete a sheet
router.delete('/:workspaceId/sheets/:sheetId', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, sheetId } = req.params;

    const existingSheet = await prisma.spreadsheet.findFirst({
      where: { id: sheetId, workspaceId }
    });
    if (!existingSheet) {
      return res.status(404).json({ error: 'Spreadsheet not found' });
    }

    await prisma.spreadsheet.delete({
      where: { id: sheetId }
    });

    return res.json({ message: 'Spreadsheet deleted successfully', sheetId });
  } catch (err: any) {
    console.error('[Delete Sheet Error]', err);
    return res.status(500).json({ error: 'Failed to delete spreadsheet' });
  }
});

export default router;
