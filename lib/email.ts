import { Resend } from 'resend';
import { createChildLogger } from '@/lib/logger';

const FROM = 'Ajo Platform <alerts@yourdomain.com>';
const logger = createChildLogger({ service: 'lib', module: 'email' });

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResend();
  if (!resend) return;

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Verify your email address",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Ajo!</h2>
          <p>Please click the button below to verify your email address and activate your account. This link will expire in 24 hours.</p>
          <div style="margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; rounded: 6px; font-weight: bold;">Verify Email</a>
          </div>
          <p>If you did not create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="font-size: 12px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #6b7280;">${verificationUrl}</p>
        </div>
      `,
    });
  } catch (err) {
    logger.error('sendVerificationEmail failed', { err, email });
  }
}

export async function sendPayoutAlert(email: string, userName: string, amount: number) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "It's your turn — payout ready!",
      html: `<p>Hi ${userName},</p><p>Your payout of <strong>${amount} XLM</strong> is ready to claim. Log in to your Ajo dashboard to claim it.</p>`,
    });
  } catch (err) {
    logger.error('sendPayoutAlert failed', { err, email });
  }
}

export async function sendContributionReminder(email: string, userName: string, amount: number, circleName: string) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Contribution due for ${circleName}`,
      html: `<p>Hi ${userName},</p><p>Your contribution of <strong>${amount} XLM</strong> is due for the circle <strong>${circleName}</strong>. Please contribute before the deadline.</p>`,
    });
  } catch (err) {
    logger.error('sendContributionReminder failed', { err, email, circleName });
  }
}
