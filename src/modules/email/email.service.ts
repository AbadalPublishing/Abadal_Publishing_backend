import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService, private prisma: PrismaService) {
    const user = config.get('SMTP_USER');
    const pass = config.get('SMTP_PASS');
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }
  }

  private async send(opts: { to: string; subject: string; html: string; userId?: string; type: string }) {
    let status = 'SENT';
    let error: string | null = null;
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.config.get('SMTP_FROM', 'Abadal Publishing <no-reply@abadalpublishing.com>'),
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
    const html = `<h2>Your book has been approved!</h2><p><strong>${product.title}</strong> is now live on the Abadal Publishing catalogue.</p>`;
    await this.send({
      to: email, subject: `"${product.title}" is now live on Abadal Publishing`,
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
}
