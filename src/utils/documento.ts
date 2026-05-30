export function stripDocumento(value: string): string {
  return value.replace(/\D/g, '');
}

export function isCnpj(value: string): boolean {
  return stripDocumento(value).length === 14;
}

export function isCpf(value: string): boolean {
  return stripDocumento(value).length === 11;
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function validateCpf(cpf: string): boolean {
  const digits = stripDocumento(cpf);
  if (digits.length !== 11 || allSameDigits(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(digits[10]);
}

export function validateCnpj(cnpj: string): boolean {
  const digits = stripDocumento(cnpj);
  if (digits.length !== 14 || allSameDigits(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== Number(digits[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === Number(digits[13]);
}

export function validateCpfCnpj(value: string): boolean {
  const digits = stripDocumento(value);
  if (digits.length === 11) return validateCpf(digits);
  if (digits.length === 14) return validateCnpj(digits);
  return false;
}

export function formatDocumento(value: string): string {
  const digits = stripDocumento(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export const GENEROS_USUARIO = [
  'Masculino',
  'Feminino',
  'Outro',
  'Empresa',
  'Prefiro não informar',
] as const;

export type GeneroUsuario = (typeof GENEROS_USUARIO)[number];

export function generoFromDocumento(documento: string): GeneroUsuario | null {
  if (isCnpj(documento)) return 'Empresa';
  return null;
}
