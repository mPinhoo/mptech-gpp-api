export const PRAZO_ALERTA_DIAS = 3;

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function diasAtePrazo(prazoEntrega: Date | string): number {
  const prazo = startOfDay(new Date(prazoEntrega));
  const hoje = startOfDay(new Date());
  return Math.round((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function isPrazoEmAlerta(prazoEntrega: Date | string): boolean {
  return diasAtePrazo(prazoEntrega) <= PRAZO_ALERTA_DIAS;
}

export function normalizeColunaNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isColunaProducaoAlerta(nomeColuna: string | null | undefined): boolean {
  if (!nomeColuna) return false;

  const normalized = normalizeColunaNome(nomeColuna);
  return (
    normalized.includes('aguardando producao') ||
    normalized.includes('em producao') ||
    normalized.includes('produzindo')
  );
}

export function calcularAlertaPrazo(
  prazoEntrega: Date | string,
  nomeColuna: string | null | undefined
): boolean {
  return isColunaProducaoAlerta(nomeColuna) && isPrazoEmAlerta(prazoEntrega);
}

function formatDateBR(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export function buildMensagemAlertaPrazo(
  numero: string,
  clienteNome: string,
  prazoEntrega: Date | string
): string {
  const dias = diasAtePrazo(prazoEntrega);
  const prazoFormatado = formatDateBR(prazoEntrega);

  if (dias < 0) {
    return `O pedido ${numero} (${clienteNome}) está atrasado há ${Math.abs(dias)} dia(s). Prazo: ${prazoFormatado}.`;
  }

  if (dias === 0) {
    return `O pedido ${numero} (${clienteNome}) vence hoje (${prazoFormatado}).`;
  }

  return `O pedido ${numero} (${clienteNome}) vence em ${dias} dia(s) (${prazoFormatado}).`;
}
