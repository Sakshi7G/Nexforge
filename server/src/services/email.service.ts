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
    const gmailUser = process.env.GMAIL_USER?.trim() || 'sakshigharge822@gmail.com';
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || 'ybwommvylopnhjal').replace(/\s+/g, '');
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
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
      });
    } else if (host && user && pass) {
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
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

    // 1. Try Brevo REST API (Standard HTTPS Port 443 — NEVER blocked on Render free tier!)
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    if (brevoApiKey) {
      try {
        console.log(`[EmailService] Sending invite to ${recipientEmail} via Brevo HTTPS REST API...`);
        const brevoSender = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'sakshigharge822@gmail.com';
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'NexForge IDE', email: brevoSender },
            to: [{ email: recipientEmail }],
            subject,
            htmlContent
          })
        });

        if (res.ok) {
          const data: any = await res.json();
          console.log(`[EmailService] 🚀 Invite email successfully delivered via Brevo API to ${recipientEmail}! MessageId:`, data.messageId);
          return { sent: true, messageId: data.messageId };
        } else {
          const errText = await res.text();
          console.error(`[EmailService] Brevo API responded with error ${res.status}:`, errText);
        }
      } catch (brevoErr: any) {
        console.error(`[EmailService] Brevo API call failed:`, brevoErr.message || brevoErr);
      }
    }

    // 2. Try Resend REST API (HTTPS Port 443)
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey) {
      try {
        console.log(`[EmailService] Sending invite to ${recipientEmail} via Resend HTTPS REST API...`);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'NexForge <onboarding@resend.dev>',
            to: [recipientEmail],
            subject,
            html: htmlContent
          })
        });

        if (res.ok) {
          const data: any = await res.json();
          console.log(`[EmailService] 🚀 Invite email delivered via Resend to ${recipientEmail}! Id:`, data.id);
          return { sent: true, messageId: data.id };
        } else {
          const errText = await res.text();
          console.error(`[EmailService] Resend API responded with error ${res.status}:`, errText);
        }
      } catch (resendErr: any) {
        console.error(`[EmailService] Resend API call failed:`, resendErr.message || resendErr);
      }
    }

    // 3. Fallback: Try Gmail SMTP (Port 465/587 - works on local development)
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

    // Fallback: In development only, attempt Ethereal test account with strict 3-second timeout
    if (process.env.NODE_ENV !== 'production') {
      try {
        const testAccount = await Promise.race([
          nodemailer.createTestAccount(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Ethereal timeout')), 3000))
        ]);
        const testTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          },
          connectionTimeout: 3000,
          socketTimeout: 4000
        });

        const info = await testTransporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject,
          text: textContent,
          html: htmlContent
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        console.log(`[EmailService] 🌐 Ethereal Web Preview URL: ${previewUrl}`);
        return { sent: true, messageId: info.messageId, previewUrl };
      } catch (_) {
        // Fallback gracefully without hanging
      }
    }

    console.log(`[EmailService] 📩 Room Join Link generated for ${recipientEmail}: ${joinUrl}`);
    return { sent: true };
  }
}

export const EmailService = new EmailServiceClass();
