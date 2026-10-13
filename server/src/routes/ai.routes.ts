import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest, requireWorkspaceMember } from '../middleware/auth';
import { AIService } from '../services/ai.service';
import { prisma } from '../db/client';
import { ENV } from '../config/env';

const router = Router();
router.use(authenticateJWT);

// POST /api/workspaces/ai/config-key (Set API Key dynamically)
router.post('/ai/config-key', async (req: AuthRequest, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    ENV.GEMINI_API_KEY = apiKey;
    process.env.GEMINI_API_KEY = apiKey;
    res.json({ success: true, message: 'Gemini API Key updated successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update API key', details: error.message });
  }
});

// POST /api/workspaces/:workspaceId/ai/prompt
router.post('/:workspaceId/ai/prompt', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const {
      promptType,
      userPrompt,
      activeFileContent,
      activeFilePath,
      selectedCode,
      errorLog,
      gitDiff,
      sessionId
    } = req.body;

    if (!userPrompt && !errorLog && !selectedCode && !activeFileContent && !gitDiff) {
      return res.status(400).json({ error: 'Prompt content or context required' });
    }

    const aiResult = await AIService.processAIRequest({
      promptType: promptType || 'chat',
      userPrompt: userPrompt || '',
      activeFileContent,
      activeFilePath,
      selectedCode,
      errorLog,
      gitDiff
    });

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = await prisma.aISession.create({
        data: {
          workspaceId,
          title: userPrompt ? userPrompt.slice(0, 40) : `${promptType.toUpperCase()} Assistant`
        }
      });
      currentSessionId = session.id;
    }

    await prisma.aIMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'user',
        content: userPrompt || `${promptType} request`,
        promptType: promptType || 'chat',
        codeContext: activeFilePath ? `[File: ${activeFilePath}]` : null
      }
    });

    await prisma.aIMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'assistant',
        content: aiResult.response,
        promptType: promptType || 'chat'
      }
    });

    res.json({
      sessionId: currentSessionId,
      response: aiResult.response,
      suggestedDiff: aiResult.suggestedDiff
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process AI request', details: error.message });
  }
});

// GET /api/workspaces/:workspaceId/ai/history
router.get('/:workspaceId/ai/history', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const sessions = await prisma.aISession.findMany({
      where: { workspaceId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch AI history', details: error.message });
  }
});

export default router;
