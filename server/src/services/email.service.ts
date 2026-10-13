import nodemailer from 'nodemailer';

interface SendInviteParams {
  recipientEmail: string;
  inviterName: string;
  workspaceName: string;
  workspaceId: string;
  role: string;
  joinUrl: string;
}

class EmailServiceClass {
  private getTransporter(): nodemailer.Transporter | null {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || gmailUser;
    const pass = process.env.SMTP_PASS || gmailPass;

    if (gmailUser && gmailPass) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });
    } else if (host && user && pass) {
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    }
    return null;
  }

  public async sendWorkspaceInviteEmail(params: SendInviteParams): Promise<{ sent: boolean; messageId?: string; previewUrl?: string }> {
    const { recipientEmail, inviterName, workspaceName, role, joinUrl } = params;

    const fromAddress = process.env.EMAIL_FROM || (process.env.GMAIL_USER ? `"NexForge IDE" <${process.env.GMAIL_USER}>` : '"NexForge IDE" <no-reply@nexforge.dev>');
    const subject = `🚀 Invitation to join "${workspaceName}" on NexForge`;

    const textContent = `Hello!

You have been invited by ${inviterName} to join the collaborative workspace room "${workspaceName}" on NexForge.

Permission Role: ${role.toUpperCase()}
Join Link: ${joinUrl}

Click the link above or copy-paste it into your browser to enter the room.

Happy coding!
- The NexForge Team`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0d14; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #121824; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
          .logo { width: 36px; height: 36px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); border-radius: 10px; display: inline-block; }
          .title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
          .desc { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
          .badge { display: inline-block; background: rgba(99, 102, 241, 0.15); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.3); padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4); }
          .link-box { background: #0a0d14; border: 1px solid rgba(255, 255, 255, 0.08); padding: 12px 16px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #06b6d4; margin-top: 16px; }
          .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand">
            <span class="logo"></span>
            <span style="font-size: 20px; font-weight: 800; color: #ffffff;">NexForge IDE</span>
          </div>

          <h1 class="title">You're invited to collaborate!</h1>

          <p class="desc">
            Hello!<br/><br/>
            <strong>${inviterName}</strong> has invited you to join the real-time collaborative room <strong>"${workspaceName}"</strong> on NexForge.
          </p>

          <div class="badge">Permission Role: ${role.toUpperCase()}</div>

          <div class="btn-container">
            <a href="${joinUrl}" class="btn" target="_blank">Join Room / Session</a>
          </div>

          <p class="desc" style="font-size: 13px;">Or copy and paste this direct link into your browser:</p>
          <div class="link-box">${joinUrl}</div>

          <div class="footer">
            NexForge © 2026 • Real-Time Collaborative IDE with Gemini AI
          </div>
        </div>
      </body>
      </html>
    `;

    const activeTransporter = this.getTransporter();
    if (activeTransporter) {
      try {
        const info = await activeTransporter.sendMail({
          from: fromAddress,
          replyTo: process.env.GMAIL_USER || fromAddress,
          to: recipientEmail,
          subject,
          text: textContent,
          html: htmlContent,
          priority: 'high'
        });
        console.log(`[EmailService] Invitation email successfully sent to ${recipientEmail} via Gmail. MessageId: ${info.messageId}`);
        return { sent: true, messageId: info.messageId };
      } catch (err: any) {
        console.error(`[EmailService] Failed to send email to ${recipientEmail} via Gmail SMTP:`, err.message || err);
      }
    }

    // Fallback: Create test account with Ethereal if SMTP not configured or failed
    try {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      const info = await testTransporter.sendMail({
        from: fromAddress,
        to: recipientEmail,
        subject,
        text: textContent,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      console.log(`\n======================================================`);
      console.log(`[EmailService] 📩 INVITATION EMAIL DISPATCHED TO: ${recipientEmail}`);
      console.log(`[EmailService] Subject: ${subject}`);
      console.log(`[EmailService] Direct Room Join Link: ${joinUrl}`);
      if (previewUrl) console.log(`[EmailService] 🌐 Ethereal Web Preview URL: ${previewUrl}`);
      console.log(`======================================================\n`);

      return { sent: true, messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.log(`\n[EmailService] 📩 INVITATION EMAIL LOG (Offline mode):`);
      console.log(`To: ${recipientEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Message:\n${textContent}\n`);
      return { sent: true };
    }
  }
}

export const EmailService = new EmailServiceClass();
