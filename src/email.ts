/**
 * QuickRefurbz - Email Service
 * SendGrid integration for sending transactional emails
 */

import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@quicklotzwms.com';
const APP_URL = process.env.APP_URL || 'https://quickrefurbz.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!SENDGRID_API_KEY;
}

/**
 * Send an invite email to a new user
 */
export async function sendInviteEmail(
  email: string,
  name: string,
  token: string,
  inviterName: string
): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[Email] Would send invite to ${email} (SendGrid not configured)`);
    console.log(`[Email] Invite link: ${APP_URL}/accept-invite?token=${token}`);
    return;
  }

  const inviteUrl = `${APP_URL}/accept-invite?token=${token}`;

  const msg = {
    to: email,
    from: {
      email: EMAIL_FROM,
      name: 'QuickRefurbz'
    },
    subject: 'You\'ve been invited to QuickRefurbz',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #171717; border-radius: 12px; padding: 32px; border: 1px solid #27272a;">
          <h1 style="color: #F1C40F; margin: 0 0 24px 0; font-size: 24px;">QuickRefurbz</h1>

          <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${name},</p>

          <p style="margin: 0 0 16px 0; color: #a1a1aa;">
            ${inviterName} has invited you to join QuickRefurbz, our refurbishment management system.
          </p>

          <p style="margin: 0 0 24px 0; color: #a1a1aa;">
            Click the button below to set up your password and activate your account:
          </p>

          <a href="${inviteUrl}" style="display: inline-block; background: #F1C40F; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Accept Invitation
          </a>

          <p style="margin: 24px 0 0 0; color: #71717a; font-size: 12px;">
            This invite link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;">

          <p style="margin: 0; color: #71717a; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #F1C40F; word-break: break-all;">${inviteUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name},

${inviterName} has invited you to join QuickRefurbz.

Click this link to set up your password and activate your account:
${inviteUrl}

This invite link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.`
  };

  try {
    await sgMail.send(msg);
    console.log(`[Email] Invite sent to ${email}`);
  } catch (error: any) {
    console.error('[Email] Failed to send invite:', error.response?.body || error);
    throw new Error('Failed to send invite email');
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[Email] Would send password reset to ${email} (SendGrid not configured)`);
    console.log(`[Email] Reset link: ${APP_URL}/reset-password?token=${token}`);
    return;
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const msg = {
    to: email,
    from: {
      email: EMAIL_FROM,
      name: 'QuickRefurbz'
    },
    subject: 'Reset your QuickRefurbz password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #171717; border-radius: 12px; padding: 32px; border: 1px solid #27272a;">
          <h1 style="color: #F1C40F; margin: 0 0 24px 0; font-size: 24px;">QuickRefurbz</h1>

          <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${name},</p>

          <p style="margin: 0 0 16px 0; color: #a1a1aa;">
            We received a request to reset your password. Click the button below to choose a new password:
          </p>

          <a href="${resetUrl}" style="display: inline-block; background: #F1C40F; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Reset Password
          </a>

          <p style="margin: 24px 0 0 0; color: #71717a; font-size: 12px;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;">

          <p style="margin: 0; color: #71717a; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #F1C40F; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name},

We received a request to reset your password.

Click this link to choose a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.`
  };

  try {
    await sgMail.send(msg);
    console.log(`[Email] Password reset sent to ${email}`);
  } catch (error: any) {
    console.error('[Email] Failed to send password reset:', error.response?.body || error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send a welcome email after account activation
 */
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[Email] Would send welcome email to ${email} (SendGrid not configured)`);
    return;
  }

  const msg = {
    to: email,
    from: {
      email: EMAIL_FROM,
      name: 'QuickRefurbz'
    },
    subject: 'Welcome to QuickRefurbz!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #171717; border-radius: 12px; padding: 32px; border: 1px solid #27272a;">
          <h1 style="color: #F1C40F; margin: 0 0 24px 0; font-size: 24px;">QuickRefurbz</h1>

          <p style="margin: 0 0 16px 0; font-size: 16px;">Welcome, ${name}!</p>

          <p style="margin: 0 0 16px 0; color: #a1a1aa;">
            Your account has been activated. You can now log in to QuickRefurbz and start using the refurbishment management system.
          </p>

          <a href="${APP_URL}/login" style="display: inline-block; background: #F1C40F; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Log In Now
          </a>

          <p style="margin: 24px 0 0 0; color: #71717a; font-size: 12px;">
            If you have any questions, reach out to your administrator.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Welcome, ${name}!

Your account has been activated. You can now log in to QuickRefurbz.

Log in at: ${APP_URL}/login

If you have any questions, reach out to your administrator.`
  };

  try {
    await sgMail.send(msg);
    console.log(`[Email] Welcome email sent to ${email}`);
  } catch (error: any) {
    console.error('[Email] Failed to send welcome email:', error.response?.body || error);
    // Don't throw - welcome email is not critical
  }
}
