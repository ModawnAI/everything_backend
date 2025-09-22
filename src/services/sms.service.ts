// SMS service for sending text messages
export class SmsService {
  async sendSms(to: string, message: string): Promise<boolean> {
    // Implementation would go here
    return true;
  }

  async sendTemplateSms(to: string, templateId: string, data: any): Promise<boolean> {
    // Implementation would go here
    return true;
  }
}

export const smsService = new SmsService();
