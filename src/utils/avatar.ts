import { AppError } from './errors.js';

const MAX_AVATAR_BYTES = Math.floor(1.5 * 1024 * 1024);
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function validateAvatarUrl(avatarUrl: string | null | undefined): void {
  if (avatarUrl === undefined) {
    return;
  }

  if (avatarUrl === null || avatarUrl === '') {
    return;
  }

  const match = avatarUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) {
    throw new AppError('Formato de imagem inválido. Use JPEG, PNG, GIF ou WebP.', 400, 'INVALID_AVATAR');
  }

  const mimeType = match[1];
  const base64Data = match[2];

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError('Formato de imagem inválido. Use JPEG, PNG, GIF ou WebP.', 400, 'INVALID_AVATAR');
  }

  const sizeBytes = Buffer.from(base64Data, 'base64').length;
  if (sizeBytes > MAX_AVATAR_BYTES) {
    throw new AppError('A imagem deve ter no máximo 1,5 MB', 400, 'AVATAR_TOO_LARGE');
  }
}
