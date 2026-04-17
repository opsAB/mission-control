import { marked } from 'marked';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = path.join(process.cwd(), 'data', 'artifacts');

export type RenderKind = 'markdown' | 'html' | 'text' | 'json' | 'binary' | 'image' | 'pdf' | 'missing';

export interface RenderedArtifact {
  kind: RenderKind;
  html?: string;       // rendered HTML for markdown/html
  text?: string;       // raw text for text/json
  mime?: string;       // original mime for binary/image/pdf
  filename?: string;
  size?: number;
}

const TEXT_EXT = new Set(['.md', '.markdown', '.txt', '.csv', '.log']);
const CODE_EXT = new Set(['.js', '.ts', '.tsx', '.jsx', '.py', '.sh', '.json', '.yaml', '.yml', '.toml', '.html', '.css']);

marked.setOptions({ gfm: true, breaks: false });

export function renderArtifact(filePath: string | null | undefined): RenderedArtifact {
  if (!filePath) return { kind: 'missing' };
  // Resolve relative paths into the MC artifact dir when needed.
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ARTIFACT_DIR, filePath);
  if (!fs.existsSync(abs)) return { kind: 'missing', filename: path.basename(filePath) };

  const ext = path.extname(abs).toLowerCase();
  const filename = path.basename(abs);
  const size = fs.statSync(abs).size;

  if (ext === '.md' || ext === '.markdown') {
    const raw = fs.readFileSync(abs, 'utf8');
    return { kind: 'markdown', html: String(marked.parse(raw)), text: raw, filename, size };
  }
  if (ext === '.html' || ext === '.htm') {
    const raw = fs.readFileSync(abs, 'utf8');
    return { kind: 'html', html: raw, text: raw, filename, size };
  }
  if (ext === '.json') {
    const raw = fs.readFileSync(abs, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      return { kind: 'json', text: JSON.stringify(parsed, null, 2), filename, size };
    } catch {
      return { kind: 'text', text: raw, filename, size };
    }
  }
  if (TEXT_EXT.has(ext) || CODE_EXT.has(ext)) {
    const raw = fs.readFileSync(abs, 'utf8');
    return { kind: 'text', text: raw, filename, size };
  }
  if (ext === '.pdf') return { kind: 'pdf', mime: 'application/pdf', filename, size };
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    return { kind: 'image', mime: `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`, filename, size };
  }
  return { kind: 'binary', filename, size };
}
