/**
 * Converte conteúdo técnico da wiki em material de apoio para o chat.
 * A wiki em disco NÃO é alterada — só o contexto enviado à IA.
 */

const TECHNICAL_SECTIONS = [
  '## Endpoints API',
  '## Regras técnicas',
  '## Arquivos principais',
  '## Variáveis de ambiente',
  '## Body do POST',
  '## Padrão de resposta',
  '## Camadas da API',
  '## Camadas da UI',
  '## Stack',
];

const MENU_LABELS: Record<string, string> = {
  '/home': 'Início (Home)',
  '/agenda': 'Agenda',
  '/pedidos': 'Pedidos',
  '/pedidos/novo': 'Pedidos → Novo Pedido',
  '/area-trabalho': 'Área de Trabalho',
  '/produtos': 'Produtos',
  '/produtos/novo': 'Produtos → Novo Produto',
  '/clientes': 'Clientes',
  '/estoque': 'Estoque',
  '/precificacao': 'Precificação',
  '/perfil': 'Seu Perfil',
  '/administrativo/usuarios': 'Administrativo → Usuários',
  '/administrativo/permissoes': 'Administrativo → Permissões',
  '/pedido/[token]': 'Link enviado ao cliente',
};

function removeCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1');
}

function removeTechnicalSections(text: string): string {
  let result = text;
  for (const header of TECHNICAL_SECTIONS) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`${escaped}[\\s\\S]*?(?=\\n## |$)`, 'i'), '');
  }
  return result;
}

function simplifyRoutesSection(text: string): string {
  return text.replace(
    /## Rotas UI\n([\s\S]*?)(?=\n## |$)/i,
    (_match, body: string) => {
      const rows = body.match(/\| `([^`]+)` \|[^|\n]*/g);
      if (!rows) return '## Onde fazer no sistema\n' + body;

      const lines = rows
        .map((row: string) => {
          const route = row.match(/`([^`]+)`/)?.[1] ?? '';
          const label = MENU_LABELS[route] ?? route;
          const cells = row.split('|').map((c: string) => c.trim());
          const desc = cells[2] ?? '';
          return desc ? `- **${label}**: ${desc}` : `- **${label}**`;
        })
        .filter(Boolean);

      return `## Onde fazer no sistema\n${lines.join('\n')}\n`;
    }
  );
}

function removeApiJargon(text: string): string {
  return text
    .replace(/`?(GET|POST|PUT|PATCH|DELETE)\s+\/api\/[^`\n]+`?/gi, '')
    .replace(/\/api\/[a-z0-9/_:-]+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extrai trechos úteis da wiki técnica para o contexto do chat. */
export function simplifyWikiForChat(raw: string): string {
  let text = raw;
  text = removeCodeBlocks(text);
  text = removeTechnicalSections(text);
  text = simplifyRoutesSection(text);
  text = removeApiJargon(text);
  return text.trim();
}

/** Monta resposta amigável no modo sem IA (fallback). */
export function buildUserFriendlyExcerpt(raw: string): string {
  const simplified = simplifyWikiForChat(raw);
  const title = simplified.match(/^#\s+(.+)$/m)?.[1];

  const where = simplified.match(/## Onde fazer no sistema[\s\S]*?(?=\n## |$)/i)?.[0];
  const rules = simplified.match(/## Regras de negócio[\s\S]*?(?=\n## |$)/i)?.[0;

  const parts: string[] = [];
  if (title) parts.push(`**${title}**`);
  if (where) parts.push(where.replace('## Onde fazer no sistema', '**Onde fazer:**'));
  if (rules) {
    parts.push(
      rules
        .replace('## Regras de negócio', '**Como funciona:**')
        .replace(/## Regras de negócio —[^\n]*/gi, '**Como funciona:**')
    );
  }

  if (parts.length > 1) return parts.join('\n\n');

  return simplified.slice(0, 1000);
}
