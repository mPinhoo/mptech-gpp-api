const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('@/utils/jwt', () => ({
  signToken: jest.fn().mockReturnValue('mocked-token'),
}));

jest.mock('@/services/user-setup.service', () => ({
  initializeNewUser: jest.fn().mockResolvedValue(undefined),
}));

import bcrypt from 'bcryptjs';
import { AuthService } from '@/services/auth.service';
import { UnauthorizedError, ConflictError } from '@/utils/errors';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('deve retornar token e user com credenciais válidas', async () => {
      const user = { id: '1', nome: 'Test', email: 'test@test.com', senha: 'hashed', ativo: true };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'test@test.com', senha: '123456' });

      expect(result.token).toBe('mocked-token');
      expect(result.user.email).toBe('test@test.com');
    });

    it('deve lançar UnauthorizedError se usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'no@exist.com', senha: '123' }))
        .rejects.toThrow(UnauthorizedError);
    });

    it('deve lançar UnauthorizedError se senha incorreta', async () => {
      const user = { id: '1', nome: 'Test', email: 'test@test.com', senha: 'hashed', ativo: true };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@test.com', senha: 'wrong' }))
        .rejects.toThrow(UnauthorizedError);
    });

    it('deve lançar UnauthorizedError se usuário inativo', async () => {
      const user = { id: '1', nome: 'Test', email: 'test@test.com', senha: 'hashed', ativo: false };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login({ email: 'test@test.com', senha: '123' }))
        .rejects.toThrow(UnauthorizedError);
    });
  });

  describe('register', () => {
    it('deve criar novo usuário e retornar token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      mockPrisma.user.create.mockResolvedValue({
        id: '2', nome: 'Novo', email: 'novo@test.com', senha: 'hashed-pw',
      });

      const result = await service.register({
        nome: 'Novo', email: 'novo@test.com', senha: '123456',
      });

      expect(result.token).toBe('mocked-token');
      expect(result.user.nome).toBe('Novo');
    });

    it('deve lançar ConflictError se email já existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'exists@test.com' });

      await expect(service.register({
        nome: 'Test', email: 'exists@test.com', senha: '123456',
      })).rejects.toThrow(ConflictError);
    });
  });

  describe('me', () => {
    it('deve retornar dados do usuário', async () => {
      const user = { id: '1', nome: 'Test', email: 'test@test.com', ativo: true, createdAt: new Date() };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.me('1');
      expect(result.email).toBe('test@test.com');
    });

    it('deve lançar UnauthorizedError se usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me('invalid')).rejects.toThrow(UnauthorizedError);
    });
  });
});
