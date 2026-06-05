import fs from 'fs';
import path from 'path';

export interface WikiDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  filePath: string;
}

let cachedDocuments: WikiDocument[] | null = null;

function resolveWikiRoot(): string {
  const candidates = [
    process.env.WIKI_PATH,
    path.join(process.cwd(), 'wiki'),
    path.join(process.cwd(), '../mptech-gpp-wiki/wiki'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), 'wiki');
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw;
  const end = raw.indexOf('---', 3);
  if (end === -1) return raw;
  return raw.slice(end + 3).trim();
}

function extractTitle(content: string, fileName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]) return match[1].trim();
  return fileName.replace(/\.md$/, '').replace(/-/g, ' ');
}

function walkMarkdownFiles(dir: string, category: string, results: WikiDocument[]): void {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, entry.name, results);
      continue;
    }

    if (!entry.name.endsWith('.md') || entry.name === 'log.md') continue;

    const raw = fs.readFileSync(fullPath, 'utf-8');
    const content = stripFrontmatter(raw);

    results.push({
      id: fullPath.replace(/\\/g, '/'),
      title: extractTitle(content, entry.name),
      category,
      content,
      filePath: fullPath,
    });
  }
}

export function loadWikiDocuments(forceReload = false): WikiDocument[] {
  if (cachedDocuments && !forceReload) return cachedDocuments;

  const root = resolveWikiRoot();
  const documents: WikiDocument[] = [];

  walkMarkdownFiles(root, 'wiki', documents);

  cachedDocuments = documents;
  return documents;
}

export function getWikiStats(): { documentCount: number; wikiPath: string } {
  const docs = loadWikiDocuments();
  return { documentCount: docs.length, wikiPath: resolveWikiRoot() };
}
