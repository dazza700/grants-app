/**
 * Resend Email Client Configuration
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();

    await resend.emails.send({
      from: params.from || 'GrantMatch <notifications@yourdomain.com>',
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
