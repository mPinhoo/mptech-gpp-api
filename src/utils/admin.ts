export const ADMIN_EMAIL = 'admin@mptech.com';

export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
