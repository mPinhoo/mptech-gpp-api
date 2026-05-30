import {
  validateCpf,
  validateCnpj,
  validateCpfCnpj,
  formatDocumento,
  generoFromDocumento,
  stripDocumento,
} from '@/utils/documento';

describe('documento utils', () => {
  it('valida CPF válido', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF inválido', () => {
    expect(validateCpf('111.111.111-11')).toBe(false);
    expect(validateCpf('123')).toBe(false);
  });

  it('valida CNPJ válido', () => {
    expect(validateCnpj('11.444.777/0001-61')).toBe(true);
  });

  it('rejeita CNPJ inválido', () => {
    expect(validateCnpj('11.111.111/1111-11')).toBe(false);
  });

  it('detecta tipo pelo tamanho', () => {
    expect(validateCpfCnpj('529.982.247-25')).toBe(true);
    expect(validateCpfCnpj('11.444.777/0001-61')).toBe(true);
  });

  it('formata documento', () => {
    expect(formatDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatDocumento('11444777000161')).toBe('11.444.777/0001-61');
  });

  it('define gênero Empresa para CNPJ', () => {
    expect(generoFromDocumento('11444777000161')).toBe('Empresa');
    expect(generoFromDocumento('52998224725')).toBeNull();
  });

  it('remove caracteres não numéricos', () => {
    expect(stripDocumento('529.982.247-25')).toBe('52998224725');
  });
});
