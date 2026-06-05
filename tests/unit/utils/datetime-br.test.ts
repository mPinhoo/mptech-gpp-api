import {
  combineDateTimeBR,
  extractDateOnlyField,
  extractTimeBR,
  parseDateOnlyInput,
} from '@/utils/datetime-br';

describe('datetime-br utils', () => {
  it('deve interpretar data/hora no fuso de São Paulo', () => {
    const date = combineDateTimeBR('2026-06-05', '14:30');
    expect(date.toISOString()).toBe('2026-06-05T17:30:00.000Z');
  });

  it('deve extrair horário no fuso de São Paulo', () => {
    const date = new Date('2026-06-05T17:30:00.000Z');
    expect(extractTimeBR(date)).toBe('14:30');
  });

  it('deve preservar a data informada ao salvar campo somente-data', () => {
    const date = parseDateOnlyInput('2026-06-08');
    expect(date.toISOString()).toBe('2026-06-08T12:00:00.000Z');
    expect(extractDateOnlyField(date)).toBe('2026-06-08');
  });

  it('deve corrigir datas legadas salvas em UTC midnight', () => {
    const legacy = new Date('2026-06-08');
    expect(extractDateOnlyField(legacy)).toBe('2026-06-08');
  });

  it('deve permitir agendar lembrete alguns minutos à frente', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-02T15:27:00-03:00'));

    const agendadoPara = combineDateTimeBR('2026-06-02', '15:30');
    expect(agendadoPara.getTime()).toBeGreaterThan(Date.now());

    jest.useRealTimers();
  });
});
