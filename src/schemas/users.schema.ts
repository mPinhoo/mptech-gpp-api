import { z } from 'zod';
import {
  GENEROS_USUARIO,
  generoFromDocumento,
  stripDocumento,
  validateCpfCnpj,
} from '../utils/documento.js';

const documentoSchema = z
  .string()
  .min(1, 'CPF/CNPJ é obrigatório')
  .refine((value) => validateCpfCnpj(value), 'CPF ou CNPJ inválido')
  .transform(stripDocumento);

const documentoOptionalSchema = z
  .string()
  .optional()
  .refine(
    (value) => value === undefined || value === '' || validateCpfCnpj(value),
    'CPF ou CNPJ inválido'
  )
  .transform((value) => (value ? stripDocumento(value) : undefined));

const generoSchema = z.enum(GENEROS_USUARIO);

const dataNascimentoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida');

const cepSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.replace(/\D/g, '') : undefined))
  .refine((value) => value === undefined || value.length === 8, 'CEP inválido');

const addressFields = {
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().optional(),
  cep: cepSchema,
  pais: z.string().optional(),
  estado: z.string().optional(),
  cidade: z.string().optional(),
};

const userProfileFields = {
  documento: documentoSchema,
  dataNascimento: dataNascimentoSchema,
  nomeFantasia: z.string().nullable().optional(),
  usarNomeFantasia: z.boolean().optional().default(true),
  genero: generoSchema,
  nacionalidade: z.string().min(1, 'Nacionalidade é obrigatória'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  avatarUrl: z.string().nullable().optional(),
};

function applyGeneroFromDocumento<T extends { documento: string; genero: string }>(data: T): T {
  const generoAuto = generoFromDocumento(data.documento);
  if (generoAuto) {
    return { ...data, genero: generoAuto };
  }
  return data;
}

export const createUserSchema = z
  .object({
    nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('Email inválido'),
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    ativo: z.boolean().optional().default(true),
    grupoPermissaoId: z.string().uuid().nullable().optional(),
    ...userProfileFields,
    ...addressFields,
  })
  .transform(applyGeneroFromDocumento);

export const updateUserSchema = z
  .object({
    nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
    email: z.string().email('Email inválido').optional(),
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional(),
    ativo: z.boolean().optional(),
    grupoPermissaoId: z.string().uuid().nullable().optional(),
    documento: documentoOptionalSchema,
    dataNascimento: dataNascimentoSchema.optional(),
    nomeFantasia: z.string().nullable().optional(),
    usarNomeFantasia: z.boolean().optional(),
    genero: generoSchema.optional(),
    nacionalidade: z.string().min(1).optional(),
    telefone: z.string().min(1).optional(),
    avatarUrl: z.string().nullable().optional(),
    ...addressFields,
  })
  .transform((data) => {
    if (data.documento) {
      const generoAuto = generoFromDocumento(data.documento);
      if (generoAuto) {
        return { ...data, genero: generoAuto };
      }
    }
    return data;
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
