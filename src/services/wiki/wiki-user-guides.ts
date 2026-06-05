/**
 * Guias passo a passo para usuários finais.
 * Fonte de verdade para respostas claras — a wiki técnica continua separada.
 */

export interface UserGuide {
  id: string;
  keywords: string[];
  title: string;
  flow: string;
  steps: string[];
  tip?: string;
}

export const USER_GUIDES: UserGuide[] = [
  {
    id: 'criar-pedido',
    keywords: [
      'criar pedido', 'novo pedido', 'fazer pedido', 'cadastrar pedido',
      'fluxo pedido', 'fluxo para criar', 'como pedido', 'abrir pedido',
    ],
    title: 'Como criar um pedido',
    flow: 'Pedidos → Novo Pedido → Selecionar cliente e produtos → Salvar → Enviar para o cliente',
    steps: [
      'No menu lateral, clique em **Pedidos**',
      'Clique em **Novo Pedido**',
      'Escolha o **cliente**, a data do pedido e o prazo de entrega',
      'Adicione os **produtos** e as quantidades',
      'Se precisar, marque extras como entrega, urgência ou alteração de arte',
      'Clique em **Salvar**',
      'Para o cliente aprovar, clique em **Enviar para o Cliente** e compartilhe o link',
    ],
    tip: 'O cliente precisa estar cadastrado em **Clientes** e os produtos em **Produtos** antes de montar o pedido.',
  },
  {
    id: 'enviar-pedido',
    keywords: [
      'enviar pedido', 'mandar pedido', 'link pedido', 'cliente aprovar',
      'aprovação cliente', 'compartilhar pedido',
    ],
    title: 'Como enviar o pedido para o cliente',
    flow: 'Pedidos → Abrir pedido → Enviar para o Cliente → Copiar link',
    steps: [
      'Vá em **Pedidos** e abra o pedido desejado',
      'Confira se itens, valores e prazo estão corretos',
      'Clique em **Enviar para o Cliente**',
      'Copie o **link** e envie por WhatsApp, e-mail ou outro canal',
      'Aguarde o cliente abrir o link e clicar em **Aprovar**',
    ],
    tip: 'Depois da aprovação, o pedido aparece na **Área de Trabalho** para produção.',
  },
  {
    id: 'producao-kanban',
    keywords: [
      'kanban', 'area de trabalho', 'área de trabalho', 'produção', 'producao',
      'acompanhar pedido', 'andar pedido', 'mover pedido', 'finalizar pedido',
    ],
    title: 'Como acompanhar a produção',
    flow: 'Área de Trabalho → Arrastar pedido entre colunas → Finalizado → Arquivar',
    steps: [
      'No menu lateral, abra **Área de Trabalho**',
      'Pedidos aprovados aparecem em **Pedidos Aprovados** ou nas colunas de produção',
      'Arraste o card do pedido para a coluna certa (ex.: Em Produção)',
      'Quando terminar, mova para **Finalizado**',
      'Na coluna Finalizado, clique em **Arquivar** para concluir o pedido',
    ],
    tip: 'Pedidos com prazo próximo aparecem com destaque em vermelho.',
  },
  {
    id: 'cadastrar-produto',
    keywords: [
      'criar produto', 'novo produto', 'cadastrar produto', 'adicionar produto',
    ],
    title: 'Como cadastrar um produto',
    flow: 'Produtos → Novo Produto → Preencher dados e materiais → Salvar',
    steps: [
      'No menu lateral, clique em **Produtos**',
      'Clique em **Novo Produto**',
      'Informe nome, categoria e preço',
      'Adicione os **materiais** usados na produção (do estoque)',
      'Use o preço sugerido se quiser ajuda na precificação',
      'Clique em **Salvar**',
    ],
  },
  {
    id: 'cadastrar-cliente',
    keywords: [
      'criar cliente', 'novo cliente', 'cadastrar cliente', 'adicionar cliente',
    ],
    title: 'Como cadastrar um cliente',
    flow: 'Clientes → Novo Cliente → Preencher nome → Salvar',
    steps: [
      'No menu lateral, clique em **Clientes**',
      'Clique para **adicionar** um novo cliente',
      'Preencha o **nome** (obrigatório) e os demais dados se quiser',
      'Clique em **Salvar**',
    ],
  },
  {
    id: 'estoque-entrada',
    keywords: [
      'entrada estoque', 'adicionar estoque', 'repor estoque', 'estoque baixo',
      'matéria prima', 'materia prima',
    ],
    title: 'Como dar entrada no estoque',
    flow: 'Estoque → Entrada → Informar quantidade → Confirmar',
    steps: [
      'No menu lateral, abra **Estoque**',
      'Localize o material ou cadastre um novo',
      'Clique em **Entrada** no material desejado',
      'Informe a **quantidade** que está entrando',
      'Confirme — o saldo é atualizado automaticamente',
    ],
    tip: 'Itens em vermelho ou amarelo estão com estoque baixo ou crítico.',
  },
  {
    id: 'agenda-lembrete',
    keywords: [
      'criar lembrete', 'novo lembrete', 'agenda', 'lembrar', 'agendar',
    ],
    title: 'Como criar um lembrete na agenda',
    flow: 'Agenda → Dia desejado → Novo lembrete → Salvar',
    steps: [
      'No menu lateral, abra **Agenda**',
      'Clique no **dia** em que quer o lembrete',
      'Clique em **Novo lembrete**',
      'Escreva o título e escolha data e horário (no futuro)',
      'Clique em **Salvar**',
    ],
    tip: 'Você pode criar até 5 lembretes por dia.',
  },
  {
    id: 'precificacao',
    keywords: [
      'precificar', 'precificação', 'precificacao', 'calcular preço', 'margem',
      'configurar preço',
    ],
    title: 'Como configurar a precificação',
    flow: 'Precificação → Salário e custos → Salvar → Usar ao cadastrar produtos',
    steps: [
      'No menu lateral, abra **Precificação**',
      'Preencha salário, horas trabalhadas e custos fixos',
      'Configure as taxas (cartão, impostos, etc.) se aplicável',
      'Clique em **Salvar**',
      'Ao criar um produto, o sistema sugere preço com base nessa configuração',
    ],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ');
}

export function matchUserGuide(message: string): UserGuide | null {
  const normalized = normalize(message);
  let best: { guide: UserGuide; score: number } | null = null;

  for (const guide of USER_GUIDES) {
    let score = 0;
    for (const keyword of guide.keywords) {
      const nk = normalize(keyword);
      if (normalized.includes(nk)) {
        score += nk.split(/\s+/).length + 2;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { guide, score };
    }
  }

  if (!best || best.score < 3) return null;
  return best.guide;
}

export function formatUserGuideReply(guide: UserGuide): string {
  const numbered = guide.steps
    .map((step, i) => `${i + 1}. ${step}`)
    .join('\n');

  let reply = `${guide.title}:\n\n**${guide.flow}**\n\n${numbered}`;

  if (guide.tip) {
    reply += `\n\n💡 ${guide.tip}`;
  }

  return reply;
}
