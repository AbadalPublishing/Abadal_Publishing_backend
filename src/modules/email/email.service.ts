import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService, private prisma: PrismaService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const host = config.get<string>('SMTP_HOST');
    const port = parseInt(config.get<string>('SMTP_PORT') || '465', 10);
    if (user && pass) {
      if (host) {
        // Generic SMTP — Resend, Brevo, Mailgun, custom server, etc.
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
        this.logger.log(`Email transport: SMTP ${host}:${port} as ${user}`);
      } else {
        // Back-compat: Gmail well-known service
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass },
        });
        this.logger.log(`Email transport: Gmail as ${user}`);
      }
    } else {
      this.logger.warn('Email transport: NOT configured — set SMTP_USER + SMTP_PASS (and SMTP_HOST for non-Gmail)');
    }
  }

  private async send(opts: { to: string; subject: string; html: string; userId?: string; type: string }) {
    let status = 'SENT';
    let error: string | null = null;
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.config.get('SMTP_FROM', 'Abadal <no-reply@abadalpublishing.com>'),
          to: opts.to, subject: opts.subject, html: opts.html,
        });
      } else {
        this.logger.log(`[EMAIL] to=${opts.to} subject=${opts.subject}`);
        status = 'LOGGED';
      }
    } catch (e: any) {
      status = 'FAILED';
      error = e?.message;
      this.logger.warn(`Email failed: ${e?.message}`);
    }
    await this.prisma.emailLog.create({
      data: {
        userId: opts.userId, type: opts.type, subject: opts.subject,
        toEmail: opts.to, status, error: error || undefined,
      },
    }).catch(() => {});
  }

  async sendOrderConfirmation(order: any) {
    const html = `<h2>Order ${order.orderNumber} confirmed</h2><p>Total: PKR ${order.totalAmount}</p>`;
    await this.send({
      to: order.user?.email, subject: `Order ${order.orderNumber} Confirmed`,
      html, userId: order.userId, type: 'ORDER_CONFIRMATION',
    });
  }

  async sendOrderStatusUpdate(order: any) {
    const html = `<h2>Order ${order.orderNumber} status: ${order.status}</h2>`;
    await this.send({
      to: order.user?.email, subject: `Order ${order.orderNumber} - ${order.status}`,
      html, userId: order.userId, type: 'ORDER_STATUS',
    });
  }

  async sendLowStockAlert(variant: any) {
    const adminEmail = this.config.get('ADMIN_EMAIL', 'admin@abadalpublishing.com');
    const html = `<h2>Low stock alert</h2><p>Variant ${variant.id} stock: ${variant.stock}</p>`;
    await this.send({
      to: adminEmail, subject: 'Low stock alert',
      html, type: 'LOW_STOCK',
    });
  }

  async sendSubmissionApproved(product: any) {
    const email = product.author?.user?.email;
    if (!email) return;
    const html = `<h2>Your book has been approved!</h2><p><strong>${product.title}</strong> is now live on the Abadal catalogue.</p>`;
    await this.send({
      to: email, subject: `"${product.title}" is now live on Abadal`,
      html, userId: product.author?.userId, type: 'SUBMISSION_APPROVED',
    });
  }

  async sendSubmissionRejected(product: any, note: string) {
    const email = product.author?.user?.email;
    if (!email) return;
    const html = `<h2>Submission update for "${product.title}"</h2><p>After review, we are unable to publish this title at this time.</p>${note ? `<p><strong>Feedback:</strong> ${note}</p>` : ''}`;
    await this.send({
      to: email, subject: `Submission update: "${product.title}"`,
      html, userId: product.author?.userId, type: 'SUBMISSION_REJECTED',
    });
  }

  async sendAuthorWelcome(user: any, verifyUrl: string) {
    const firstName = user?.firstName || 'Author';
    const html = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f3ee;font-family:Helvetica,Arial,sans-serif;color:#222">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e7e2d5">
        <tr><td style="padding:28px 36px 18px;border-bottom:1px solid #e7e2d5">
          <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:.04em;color:#111">ABADAL</div>
        </td></tr>
        <tr><td style="padding:28px 36px 8px">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#111">Welcome, ${firstName}.</h1>
          <p style="margin:0 0 14px;line-height:1.6;font-size:15px;color:#333">
            Thank you for applying to publish with Abadal. Your author account has been created.
          </p>
          <p style="margin:0 0 22px;line-height:1.6;font-size:15px;color:#333">
            To activate the account and start submitting manuscripts, please confirm your email below.
          </p>
          <p style="margin:0 0 28px;text-align:center">
            <a href="${verifyUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.18em;text-transform:uppercase">Confirm Email</a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#888;line-height:1.5">
            If the button does not work, paste this link into your browser:
          </p>
          <p style="margin:0 0 24px;font-size:12px;color:#444;word-break:break-all">
            ${verifyUrl}
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#888">This link expires in 24 hours.</p>
        </td></tr>
        <tr><td style="padding:18px 36px 28px;border-top:1px solid #e7e2d5;font-size:12px;color:#888;line-height:1.5">
          <em>Abadal</em> · Peshawar, Pakistan<br/>
          If you did not apply for an author account, you can safely ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    await this.send({
      to: user.email,
      subject: 'Confirm your Abadal author account',
      html,
      userId: user.id,
      type: 'AUTHOR_WELCOME',
    });
  }

}
