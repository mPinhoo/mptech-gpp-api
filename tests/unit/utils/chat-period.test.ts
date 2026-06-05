import { resolveChatPeriodo } from '@/utils/chat-period';

describe('resolveChatPeriodo', () => {
  it('resolve ultimos_n_dias com dias customizados', () => {
    const range = resolveChatPeriodo({ periodo: 'ultimos_n_dias', dias: 10 });
    expect(range.label).toBe('nos últimos 10 dias');
    expect(range.start).not.toBeNull();
  });

  it('resolve ate_hoje sem data inicial', () => {
    const range = resolveChatPeriodo({ periodo: 'ate_hoje' });
    expect(range.start).toBeNull();
    expect(range.label).toContain('até hoje');
  });

  it('resolve mes_passado', () => {
    const range = resolveChatPeriodo({ periodo: 'mes_passado' });
    expect(range.label).toBe('no mês passado');
    expect(range.start).not.toBeNull();
  });

  it('resolve ano', () => {
    const range = resolveChatPeriodo({ periodo: 'ano' });
    expect(range.label).toContain('último ano');
  });
});
