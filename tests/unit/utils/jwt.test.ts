import jwt from 'jsonwebtoken';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

jest.mock('jsonwebtoken');

describe('JWT Utils', () => {
  const mockPayload = { userId: 'user-123', email: 'test@test.com' };

  describe('signToken', () => {
    it('deve gerar um token com payload e expiração', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mocked-token');

      const { signToken } = require('@/utils/jwt');
      const token = signToken(mockPayload);

      expect(token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        expect.any(String),
        { expiresIn: '24h' }
      );
    });
  });

  describe('verifyToken', () => {
    it('deve verificar e retornar o payload de um token válido', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const { verifyToken } = require('@/utils/jwt');
      const result = verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
    });

    it('deve lançar erro para token inválido', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });

      const { verifyToken } = require('@/utils/jwt');
      expect(() => verifyToken('invalid-token')).toThrow();
    });
  });
});
