import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import os from 'os';
import { prisma } from '../db/client';
import { authenticateJWT, AuthRequest, requireWorkspaceMember } from '../middleware/auth';
import { FileService } from '../services/file.service';
import { EmailService } from '../services/email.service';
import { TunnelService } from '../services/tunnel.service';

function getDynamicAppUrl(req: Request): string {
  // 1. If request comes from a cloud origin (Vercel, custom domain), that is the worldwide link
  const rawOrigin = (req.headers.origin || req.headers.referer || '').replace(/\/$/, '');
  if (rawOrigin && !rawOrigin.includes('localhost') && !rawOrigin.includes('127.0.0.1') && !rawOrigin.includes('192.168.') && !rawOrigin.includes('10.')) {
    return rawOrigin;
  }

  // 2. Cloudflare / Localtunnel public tunnel if active
  const publicTunnel = TunnelService.getPublicUrl();
  if (publicTunnel) {
    return publicTunnel;
  }

  if (process.env.APP_URL && !process.env.APP_URL.includes('localhost')) {
    return process.env.APP_URL;
  }

  // 3. Local Wi-Fi / LAN IP for local testing
  let lanIp = '';
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        lanIp = `http://${alias.address}:3000`;
        break;
      }
    }
    if (lanIp) break;
  }

  if (rawOrigin) {
    return rawOrigin;
  }

  if (lanIp) {
    return lanIp;
  }

  return 'http://localhost:3000';
}

const router = Router();

// Apply auth to all workspace routes
router.use(authenticateJWT);

// GET /api/workspaces/lan-info (network and tunnel metadata)
router.get('/lan-info', (req: Request, res: Response) => {
  const publicTunnel = TunnelService.getPublicUrl();
  const tunnelStatus = TunnelService.getStatus();

  let lanIp = '';
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        lanIp = `http://${alias.address}:3000`;
        break;
      }
    }
    if (lanIp) break;
  }

  const appUrl = getDynamicAppUrl(req);
  res.json({
    appUrl,
    publicTunnelUrl: publicTunnel,
    lanUrl: lanIp,
    status: tunnelStatus
  });
});

// GET /api/workspaces
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ workspaces });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch workspaces', details: error.message });
  }
});

// POST /api/workspaces
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, language } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const selectedLanguage = language || 'typescript';

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        language: selectedLanguage,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'owner'
          }
        }
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });

    // Seed disk files & DB records for workspace starter template
    await FileService.initDefaultWorkspaceFiles(workspace.id, selectedLanguage);

    res.status(201).json({ workspace });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create workspace', details: error.message });
  }
});

// POST /api/workspaces/:workspaceId/join
router.post('/:workspaceId/join', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    // Search workspace by ID or name
    let workspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { id: workspaceId },
          { name: { equals: workspaceId } }
        ]
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }
      }
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace room not found' });
    }

    // Check if user is already member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId }
    });

    if (!existingMember) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'editor'
        }
      });

      // Refetch workspace with updated members
      workspace = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }
        }
      });
    }

    res.json({ workspace });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to join workspace', details: error.message });
  }
});

// GET /api/workspaces/:workspaceId
router.get('/:workspaceId', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }
      }
    });

    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json({ workspace });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch workspace details' });
  }
});

// POST /api/workspaces/:workspaceId/members
router.post('/:workspaceId/members', requireWorkspaceMember, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { email, role } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g. user@company.com)' });
    }

    // Fetch workspace details for the email notification
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    let userToInvite = await prisma.user.findUnique({ where: { email: cleanEmail } });

    // Auto-provision user account if email is not registered in system yet
    if (!userToInvite) {
      const defaultPasswordHash = await bcrypt.hash('nexforge123', 10);
      const nameFromEmail = cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(nameFromEmail)}`;

      userToInvite = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: nameFromEmail || 'Teammate',
          passwordHash: defaultPasswordHash,
          avatarUrl
        }
      });
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: userToInvite.id }
    });

    let member;
    let isExisting = false;

    if (existingMember) {
      isExisting = true;
      member = await prisma.workspaceMember.update({
        where: { id: existingMember.id },
        data: { role: role || 'editor' },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } }
        }
      });
    } else {
      member = await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: userToInvite.id,
          role: role || 'editor'
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } }
        }
      });
    }

    const inviterName = req.user?.name || 'A teammate';
    const baseAppUrl = getDynamicAppUrl(req);
    const joinUrl = `${baseAppUrl.replace(/\/$/, '')}?room=${workspaceId}`;

    // Send actual email notification via EmailService with safety timeout
    let emailResult = { sent: false, previewUrl: undefined as string | undefined };
    try {
      emailResult = await Promise.race([
        EmailService.sendWorkspaceInviteEmail({
          recipientEmail: cleanEmail,
          inviterName,
          workspaceName: workspace.name,
          workspaceId,
          role: role || 'editor',
          joinUrl
        }),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Email dispatch timeout')), 6000))
      ]);
    } catch (emailErr: any) {
      console.warn('[WorkspaceRoutes] Email dispatch notice:', emailErr.message || emailErr);
    }

    const statusMsg = emailResult.sent
      ? `Invitation email successfully sent to ${cleanEmail}!`
      : `Teammate ${cleanEmail} added! Share the direct room link with them.`;

    res.status(isExisting ? 200 : 201).json({
      member,
      message: isExisting ? `${statusMsg} Permission updated to ${role || 'editor'}.` : statusMsg,
      joinUrl,
      previewUrl: emailResult.previewUrl
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to invite member', details: error.message });
  }
});

export default router;
