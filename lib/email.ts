import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Ajo Platform <alerts@yourdomain.com>';

export async function sendPayoutAlert(email: string, userName: string, amount: number) {
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "It's your turn — payout ready!",
      html: `<p>Hi ${userName},</p><p>Your payout of <strong>${amount} XLM</strong> is ready to claim. Log in to your Ajo dashboard to claim it.</p>`,
    });
  } catch (err) {
    console.error('[email] sendPayoutAlert failed:', err);
  }
}

export async function sendContributionReminder(email: string, userName: string, amount: number, circleName: string) {
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Contribution due for ${circleName}`,
      html: `<p>Hi ${userName},</p><p>Your contribution of <strong>${amount} XLM</strong> is due for the circle <strong>${circleName}</strong>. Please contribute before the deadline.</p>`,
    });
  } catch (err) {
    console.error('[email] sendContributionReminder failed:', err);
  }
}
