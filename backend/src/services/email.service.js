import nodemailer from 'nodemailer';
import { PRODUCTION_SITE_FRONTEND_URL } from '../config/defaults.js';
import { env } from '../config/env.js';

export function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    // Railway/container DNS can prefer IPv6 for Gmail and hang until timeout.
    family: 4,
  });
}

export async function sendCustomerWelcomeEmail(site) {
  if (!site.email) return;

  const siteBaseUrl = String(env.SITE_FRONTEND_URL || PRODUCTION_SITE_FRONTEND_URL).replace(
    /\/$/,
    '',
  );
  const siteUrl = `${siteBaseUrl}/${site.slug}`;
  const subject = `Your free website is ready - ${site.businessName}`;
  const text = `Hi ${site.businessName},

Your free website has been created and is ready to view.

Your website link: ${siteUrl}

You can share this link with your customers right away.

If you need any changes to your website please contact us.

Powered by Peakwa
https://peakwa.com`;
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your free website is ready!</h2>
          <p>Hi <strong>${site.businessName}</strong>,</p>
          <p>Your free website has been created and is ready to view.</p>
          <p><strong>Your website:</strong> <a href="${siteUrl}">${siteUrl}</a></p>
          <p>You can share this link with your customers right away.</p>
          <p>If you need any changes please contact us.</p>
          <br/>
          <p>Powered by <a href="https://peakwa.com">Peakwa</a></p>
        </div>
      `;

  if (env.MOCK_MODE) {
    console.info(
      JSON.stringify({
        event: 'customer_welcome_email_mock',
        siteSlug: site.slug,
        email: site.email,
        subject,
        siteUrl,
      }),
    );
    return;
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.ALERT_EMAIL_FROM) {
    console.warn(
      JSON.stringify({
        event: 'customer_welcome_email_skipped',
        reason: 'SMTP not configured',
        siteSlug: site.slug,
      }),
    );
    return;
  }

  try {
    const transporter = createSmtpTransporter();
    await transporter.sendMail({
      from: env.ALERT_EMAIL_FROM,
      to: site.email,
      subject,
      text,
      html,
    });
    console.info(
      JSON.stringify({
        event: 'customer_welcome_email_sent',
        siteSlug: site.slug,
        email: site.email,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'customer_welcome_email_failed',
        siteSlug: site.slug,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
