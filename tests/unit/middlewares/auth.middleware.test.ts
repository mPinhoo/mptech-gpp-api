import { Request, Response, NextFunction } from 'express';

const mockVerifyToken = jest.fn();
jest.mock('@/utils/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

import { authMiddleware } from '@/middlewares/auth.middleware';
import { UnauthorizedError } from '@/utils/errors';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {};
    mockNext = jest.fn();
    mockVerifyToken.mockReset();
  });

  it('deve lançar erro quando não há header Authorization', () => {
    expect(() =>
      authMiddleware(mockReq as Request, mockRes as Response, mockNext)
    ).toThrow(UnauthorizedError);
  });

  it('deve lançar erro quando o header não começa com Bearer', () => {
    mockReq.headers = { authorization: 'Basic token123' };

    expect(() =>
      authMiddleware(mockReq as Request, mockRes as Response, mockNext)
    ).toThrow(UnauthorizedError);
  });

  it('deve lançar erro quando o token é inválido', () => {
    mockReq.headers = { authorization: 'Bearer invalid-token' };
    mockVerifyToken.mockImplementation(() => {
      throw new Error('invalid');
    });

    expect(() =>
      authMiddleware(mockReq as Request, mockRes as Response, mockNext)
    ).toThrow(UnauthorizedError);
  });

  it('deve setar req.user e chamar next() com token válido', () => {
    const payload = { userId: 'user-123', email: 'test@test.com' };
    mockReq.headers = { authorization: 'Bearer valid-token' };
    mockVerifyToken.mockReturnValue(payload);

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.user).toEqual(payload);
    expect(mockNext).toHaveBeenCalled();
  });
});
