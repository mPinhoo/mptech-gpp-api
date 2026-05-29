import { sendSupportContactEmail } from './email.service.js';
import { SupportContactInput } from '../schemas/support.schema.js';

export class SupportService {
  async contact(data: SupportContactInput) {
    await sendSupportContactEmail(data);
    return { message: 'Mensagem enviada com sucesso!' };
  }
}

export const supportService = new SupportService();
