import fs from 'fs-extra';
import path from 'path';
import { ENV } from '../config/env';
import { prisma } from '../db/client';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  content?: string | null;
  parentId?: string | null;
  children?: FileNode[];
}

export class FileService {
  public static getWorkspaceDiskPath(workspaceId: string): string {
    const dirPath = path.join(ENV.WORKSPACES_DIR, workspaceId);
    fs.ensureDirSync(dirPath);
    return dirPath;
  }

  public static async initDefaultWorkspaceFiles(workspaceId: string, language: string) {
    const diskPath = this.getWorkspaceDiskPath(workspaceId);

    // Default starter files
    let starterFile = { name: 'index.js', content: '// Welcome to NexForge Collaborative IDE\nconsole.log("Hello, NexForge!");\n' };
    if (language === 'python') {
      starterFile = { name: 'main.py', content: '# Welcome to NexForge Collaborative IDE\nprint("Hello, NexForge!")\n' };
    } else if (language === 'cpp') {
      starterFile = { name: 'main.cpp', content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, NexForge!" << std::endl;\n    return 0;\n}\n' };
    } else if (language === 'go') {
      starterFile = { name: 'main.go', content: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, NexForge!")\n}\n' };
    } else if (language === 'typescript') {
      starterFile = { name: 'index.ts', content: '// Welcome to NexForge Collaborative IDE\nconst greeting: string = "Hello, NexForge!";\nconsole.log(greeting);\n' };
    }

    const readmeFile = {
      name: 'README.md',
      content: `# NexForge Workspace\n\nAI-Powered Real-Time Collaborative IDE.\n- Language: ${language}\n- Multi-user editing active\n- Integrated Terminal & Execution Sandbox\n`
    };

    const filesToCreate = [starterFile, readmeFile];

    for (const f of filesToCreate) {
      const filePathOnDisk = path.join(diskPath, f.name);
      fs.writeFileSync(filePathOnDisk, f.content, 'utf-8');

      await prisma.file.upsert({
        where: {
          workspaceId_path: {
            workspaceId,
            path: f.name
          }
        },
        update: { content: f.content },
        create: {
          workspaceId,
          name: f.name,
          path: f.name,
          isFolder: false,
          content: f.content
        }
      });
    }
  }

  public static async syncDbToDisk(workspaceId: string): Promise<void> {
    const diskBasePath = this.getWorkspaceDiskPath(workspaceId);
    const dbFiles = await prisma.file.findMany({ where: { workspaceId } });
    for (const f of dbFiles) {
      const fullPath = path.join(diskBasePath, f.path);
      if (f.isFolder) {
        await fs.ensureDir(fullPath);
      } else if (f.content !== null && f.content !== undefined) {
        if (!await fs.pathExists(fullPath)) {
          await fs.ensureDir(path.dirname(fullPath));
          await fs.writeFile(fullPath, f.content, 'utf-8');
        }
      }
    }
  }

  /**
   * Scans workspace directory on disk and syncs new files/folders (such as venv,
   * requirements.txt, or files created via terminal) into the database so they appear
   * in the File Explorer tree just like in VS Code.
   */
  public static async syncDiskToDb(workspaceId: string): Promise<void> {
    const diskBasePath = this.getWorkspaceDiskPath(workspaceId);
    if (!fs.existsSync(diskBasePath)) return;

    const diskPaths = new Set<string>();

    const syncDirectory = async (currentDir: string, relativeParent = '', depth = 0, parentId: string | null = null) => {
      if (depth > 5) return;

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (_) {
        return;
      }

      for (const entry of entries) {
        // Skip git internal files
        if (entry.name === '.git') continue;

        const itemRelPath = relativeParent ? `${relativeParent}/${entry.name}` : entry.name;
        const fullPath = path.join(currentDir, entry.name);
        diskPaths.add(itemRelPath);

        if (entry.isDirectory()) {
          const folderRecord = await prisma.file.upsert({
            where: { workspaceId_path: { workspaceId, path: itemRelPath } },
            update: { isFolder: true },
            create: {
              workspaceId,
              name: entry.name,
              path: itemRelPath,
              isFolder: true,
              parentId
            }
          });

          // Special treatment for venv / .venv / venv_private / node_modules:
          // Index top-level and essential subfolders (Include, Lib, Scripts, pyvenv.cfg)
          // without recursively traversing the 10,000+ deep files in site-packages
          if (entry.name === 'venv' || entry.name === '.venv' || entry.name === 'venv_private' || entry.name.startsWith('venv_private') || entry.name === 'node_modules') {
            try {
              const subEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });
              for (const sub of subEntries) {
                const subRelPath = `${itemRelPath}/${sub.name}`;
                const subFullPath = path.join(fullPath, sub.name);
                diskPaths.add(subRelPath);

                if (sub.isDirectory()) {
                  await prisma.file.upsert({
                    where: { workspaceId_path: { workspaceId, path: subRelPath } },
                    update: { isFolder: true },
                    create: {
                      workspaceId,
                      name: sub.name,
                      path: subRelPath,
                      isFolder: true,
                      parentId: folderRecord.id
                    }
                  });
                } else if (sub.isFile()) {
                  let subContent = '';
                  try {
                    if (sub.name.endsWith('.cfg') || sub.name.endsWith('.txt') || sub.name.endsWith('.gitignore')) {
                      subContent = await fs.promises.readFile(subFullPath, 'utf-8');
                    }
                  } catch (_) {}

                  await prisma.file.upsert({
                    where: { workspaceId_path: { workspaceId, path: subRelPath } },
                    update: {},
                    create: {
                      workspaceId,
                      name: sub.name,
                      path: subRelPath,
                      isFolder: false,
                      content: subContent,
                      parentId: folderRecord.id
                    }
                  });
                }
              }
            } catch (_) {}
          } else {
            await syncDirectory(fullPath, itemRelPath, depth + 1, folderRecord.id);
          }
        } else if (entry.isFile()) {
          let content = '';
          try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size < 500 * 1024) {
              content = await fs.promises.readFile(fullPath, 'utf-8');
            }
          } catch (_) {}

          await prisma.file.upsert({
            where: { workspaceId_path: { workspaceId, path: itemRelPath } },
            update: { content },
            create: {
              workspaceId,
              name: entry.name,
              path: itemRelPath,
              isFolder: false,
              content,
              parentId
            }
          });
        }
      }
    };

    await syncDirectory(diskBasePath);

    // Clean up any database records for files that were deleted on disk
    try {
      const allDbFiles = await prisma.file.findMany({ where: { workspaceId } });
      for (const dbFile of allDbFiles) {
        if (!diskPaths.has(dbFile.path)) {
          await prisma.file.delete({ where: { id: dbFile.id } }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  public static async getFileTree(workspaceId: string): Promise<FileNode[]> {
    this.getWorkspaceDiskPath(workspaceId);

    // Sync disk files to database so terminal additions (e.g. venv, new scripts) appear in the UI
    try {
      await this.syncDiskToDb(workspaceId);
    } catch (syncErr) {
      console.warn('[FileService] Disk sync warning:', syncErr);
    }

    const dbFiles = await prisma.file.findMany({
      where: { workspaceId },
      orderBy: [{ isFolder: 'desc' }, { name: 'asc' }]
    });

    const fileMap: { [id: string]: FileNode } = {};
    const rootNodes: FileNode[] = [];

    dbFiles.forEach(f => {
      fileMap[f.id] = {
        id: f.id,
        name: f.name,
        path: f.path,
        isFolder: f.isFolder,
        content: f.content,
        parentId: f.parentId,
        children: f.isFolder ? [] : undefined
      };
    });

    dbFiles.forEach(f => {
      const node = fileMap[f.id];
      if (f.parentId && fileMap[f.parentId]) {
        fileMap[f.parentId].children?.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  public static async createFileOrFolder(workspaceId: string, itemPath: string, isFolder: boolean, content?: string): Promise<any> {
    const diskBasePath = this.getWorkspaceDiskPath(workspaceId);
    
    // Normalize path separators
    const normalizedPath = itemPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!normalizedPath) {
      throw new Error('Invalid file/folder path');
    }

    const diskPath = path.join(diskBasePath, normalizedPath);
    const name = path.basename(normalizedPath);
    const parentPath = path.dirname(normalizedPath);

    let parentId: string | null = null;
    if (parentPath && parentPath !== '.' && parentPath !== '') {
      // Ensure parent folder exists in DB
      let parentRecord = await prisma.file.findUnique({
        where: { workspaceId_path: { workspaceId, path: parentPath } }
      });

      if (!parentRecord) {
        parentRecord = await this.createFileOrFolder(workspaceId, parentPath, true);
      }

      if (parentRecord) {
        parentId = parentRecord.id;
      }
    }

    if (isFolder) {
      await fs.ensureDir(diskPath);
    } else {
      await fs.ensureDir(path.dirname(diskPath));
      await fs.writeFile(diskPath, content || '', 'utf-8');
    }

    const fileRecord = await prisma.file.upsert({
      where: {
        workspaceId_path: { workspaceId, path: normalizedPath }
      },
      update: {
        isFolder,
        content: isFolder ? null : (content || '')
      },
      create: {
        workspaceId,
        path: normalizedPath,
        name,
        isFolder,
        content: isFolder ? null : (content || ''),
        parentId
      }
    });

    return fileRecord;
  }

  public static async updateFileContent(workspaceId: string, filePath: string, content: string): Promise<any> {
    const diskBasePath = this.getWorkspaceDiskPath(workspaceId);
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    const diskPath = path.join(diskBasePath, normalizedPath);

    await fs.ensureDir(path.dirname(diskPath));
    await fs.writeFile(diskPath, content, 'utf-8');

    const updated = await prisma.file.upsert({
      where: {
        workspaceId_path: { workspaceId, path: normalizedPath }
      },
      update: { content },
      create: {
        workspaceId,
        path: normalizedPath,
        name: path.basename(normalizedPath),
        isFolder: false,
        content
      }
    });

    return updated;
  }

  public static async deleteFileOrFolder(workspaceId: string, filePath: string): Promise<boolean> {
    const diskBasePath = this.getWorkspaceDiskPath(workspaceId);
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    const diskPath = path.join(diskBasePath, normalizedPath);

    if (await fs.pathExists(diskPath)) {
      await fs.remove(diskPath);
    }

    const dbRecord = await prisma.file.findUnique({
      where: { workspaceId_path: { workspaceId, path: normalizedPath } }
    });

    if (dbRecord) {
      await prisma.file.deleteMany({
        where: {
          workspaceId,
          OR: [
            { id: dbRecord.id },
            { path: { startsWith: `${normalizedPath}/` } }
          ]
        }
      });
    }

    return true;
  }

  public static async renameOrMove(workspaceId: string, oldPath: string, newPath: string): Promise<any> {
    const diskBasePath = this.getWorkspaceDiskPath(workspaceId);
    const normOld = oldPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    const normNew = newPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    const oldDisk = path.join(diskBasePath, normOld);
    const newDisk = path.join(diskBasePath, normNew);

    if (await fs.pathExists(oldDisk)) {
      await fs.ensureDir(path.dirname(newDisk));
      await fs.move(oldDisk, newDisk, { overwrite: true });
    }

    const newName = path.basename(normNew);
    const updated = await prisma.file.update({
      where: { workspaceId_path: { workspaceId, path: normOld } },
      data: {
        path: normNew,
        name: newName
      }
    });

    return updated;
  }
}
