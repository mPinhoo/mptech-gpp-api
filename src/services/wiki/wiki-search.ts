import type { WikiDocument } from './wiki-loader.js';
import { simplifyWikiForChat } from './wiki-simplify.js';

const STOP_WORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'em', 'um', 'uma', 'os', 'as', 'dos', 'das',
  'para', 'com', 'por', 'que', 'como', 'no', 'na', 'nos', 'nas', 'ao', 'aos',
  'é', 'ser', 'se', 'ou', 'me', 'eu', 'você', 'voce', 'qual', 'quais', 'onde',
]);

/** Docs muito técnicos — úteis na wiki, mas não prioritários para o chat. */
const TECHNICAL_DOC_IDS = [
  'regras-tecnicas',
  'stack-tecnico',
  'arquitetura',
  'multi-tenancy',
  'autenticacao-jwt',
  'analise-codigo',
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function scoreDocument(queryTokens: string[], doc: WikiDocument): number {
  const haystack = `${doc.title} ${doc.category} ${doc.content}`.toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    const regex = new RegExp(token, 'gi');
    const matches = haystack.match(regex);
    if (matches) {
      score += matches.length;
      if (doc.title.toLowerCase().includes(token)) score += 5;
      if (doc.category.toLowerCase().includes(token)) score += 2;
    }
  }

  // Prioriza páginas de funcionalidade (mais próximas do usuário)
  if (doc.category === 'features') score += 10;
  if (doc.id.includes('regras-de-negocio')) score += 4;

  for (const technicalId of TECHNICAL_DOC_IDS) {
    if (doc.id.includes(technicalId)) score -= 12;
  }

  return score;
}

export function searchWiki(documents: WikiDocument[], query: string, limit = 5): WikiDocument[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return documents
      .filter((doc) => doc.category === 'features')
      .slice(0, limit);
  }

  return documents
    .map((doc) => ({ doc, score: scoreDocument(queryTokens, doc) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.doc);
}

/** Formata contexto para a IA — wiki técnica traduzida na camada do chat. */
export function formatDocumentsForPrompt(documents: WikiDocument[]): string {
  return documents
    .map((doc) => {
      const simplified = simplifyWikiForChat(doc.content).slice(0, 2500);
      return `### ${doc.title}\n${simplified}`;
    })
    .join('\n\n---\n\n');
}
