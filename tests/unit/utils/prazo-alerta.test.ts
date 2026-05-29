import {
  calcularAlertaPrazo,
  diasAtePrazo,
  isColunaProducaoAlerta,
  isPrazoEmAlerta,
  buildMensagemAlertaPrazo,
} from '@/utils/prazo-alerta';

describe('prazo-alerta utils', () => {
  it('deve identificar colunas de produção em alerta', () => {
    expect(isColunaProducaoAlerta('Aguardando Produção')).toBe(true);
    expect(isColunaProducaoAlerta('Em Produção')).toBe(true);
    expect(isColunaProducaoAlerta('Produzindo')).toBe(true);
    expect(isColunaProducaoAlerta('Finalizado')).toBe(false);
  });

  it('deve calcular dias até o prazo', () => {
    const prazo = new Date('2099-06-05T12:00:00');
    const hoje = new Date('2099-06-02T12:00:00');
    jest.useFakeTimers();
    jest.setSystemTime(hoje);

    expect(diasAtePrazo(prazo)).toBe(3);
    expect(isPrazoEmAlerta(prazo)).toBe(true);
    expect(calcularAlertaPrazo(prazo, 'Aguardando Produção')).toBe(true);
    expect(calcularAlertaPrazo(prazo, 'Finalizado')).toBe(false);

    jest.useRealTimers();
  });

  it('deve montar mensagem de alerta', () => {
    const prazo = new Date('2099-06-05T12:00:00');
    const hoje = new Date('2099-06-02T12:00:00');
    jest.useFakeTimers();
    jest.setSystemTime(hoje);

    const mensagem = buildMensagemAlertaPrazo('#PED-0001', 'Cliente', prazo);
    expect(mensagem).toContain('#PED-0001');
    expect(mensagem).toContain('3 dia(s)');

    jest.useRealTimers();
  });
});
