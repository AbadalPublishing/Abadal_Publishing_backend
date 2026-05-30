import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WhatsappOrdersService } from './whatsapp-orders.service';
import { CreateWhatsappOrderDto } from './dto/create-whatsapp-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { WriteRateLimit } from '../../common/decorators/throttle-auth.decorator';

@Controller('whatsapp-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappOrdersController {
  constructor(private waOrders: WhatsappOrdersService, private jwt: JwtService) {}

  @Public()
  @Post()
  @WriteRateLimit()
  async create(@Body() dto: CreateWhatsappOrderDto, @Req() req: Request) {
    // If the customer is logged in, capture their userId so the order shows
    // up in their /account/orders. Anonymous orders still work.
    let userId: string | undefined;
    const authHeader = (req.headers?.authorization || '') as string;
    if (authHeader.startsWith('Bearer ')) {
      try {
        const payload: any = this.jwt.verify(authHeader.slice(7));
        userId = payload?.sub;
      } catch { /* invalid/expired token — fall through as anonymous */ }
    }
    const order = await this.waOrders.create(dto, userId);
    return {
      id: order.id,
      refCode: order.refCode,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      createdAt: order.createdAt,
    };
  }

  // ── Public customer-facing tracking ──────────────────────────────
  @Public()
  @Get('track/:refCode')
  track(@Param('refCode') refCode: string) {
    return this.waOrders.trackByRef(refCode);
  }

  @Public()
  @Post('track/:refCode/confirm-delivery')
  @WriteRateLimit()
  confirmDelivery(@Param('refCode') refCode: string) {
    return this.waOrders.confirmDeliveryByCustomer(refCode);
  }

  // ── Authenticated customer ───────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.waOrders.mine(userId);
  }

  // ── Admin ────────────────────────────────────────────────────────
  @Get() @Roles('SUPER_ADMIN')
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.waOrders.list({ from, to, status });
  }

  @Get('book-totals') @Roles('SUPER_ADMIN')
  bookTotals(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.waOrders.bookTotals({ from, to, status });
  }

  @Patch(':id') @Roles('SUPER_ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: string; quantity?: number; notes?: string; paymentAccount?: string },
  ) {
    return this.waOrders.update(id, body);
  }

  @Get('export') @Roles('SUPER_ADMIN')
  async exportXlsx(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.waOrders.exportRows({ from, to, status });
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Abadal Publishing';
    wb.created = new Date();
    const sheet = wb.addWorksheet('WhatsApp Orders');

    sheet.columns = [
      { header: 'Order Ref',     key: 'refCode',  width: 16 },
      { header: 'Date',          key: 'date',     width: 12 },
      { header: 'Time',          key: 'time',     width: 10 },
      { header: 'Name',          key: 'name',     width: 22 },
      { header: 'Phone',         key: 'phone',    width: 16 },
      { header: 'Email',         key: 'email',    width: 26 },
      { header: 'Street',        key: 'street',   width: 32 },
      { header: 'City',          key: 'city',     width: 14 },
      { header: 'Country',       key: 'country',  width: 12 },
      { header: 'Book',          key: 'book',     width: 36 },
      { header: 'Qty',           key: 'qty',      width: 6 },
      { header: 'Unit Price',    key: 'unit',     width: 12 },
      { header: 'Subtotal',      key: 'subtotal', width: 12 },
      { header: 'Shipping',      key: 'shipping', width: 12 },
      { header: 'Total',         key: 'total',    width: 12 },
      { header: 'Payment Acct',  key: 'pay',      width: 28 },
      { header: 'Status',        key: 'status',   width: 12 },
      { header: 'Approved',      key: 'approved', width: 18 },
      { header: 'Delivered',     key: 'delivered',width: 18 },
      { header: 'Notes',         key: 'notes',    width: 36 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E2D5' } } as any;
    sheet.getRow(1).alignment = { vertical: 'middle' };

    const fmt = (d: any) => {
      if (!d) return '';
      const x = new Date(d);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
    };

    for (const r of rows as any[]) {
      const d = new Date(r.createdAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      sheet.addRow({
        refCode: r.refCode,
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        name: r.name, phone: r.phone, email: r.email,
        street: r.street, city: r.city, country: r.country,
        book: r.bookTitle, qty: r.quantity,
        unit: r.unitPrice, subtotal: r.subtotal, shipping: r.shipping, total: r.total,
        pay: r.paymentAccount,
        status: r.status,
        approved: fmt(r.approvedAt),
        delivered: fmt(r.deliveredAt),
        notes: r.notes,
      });
    }

    ['unit', 'subtotal', 'shipping', 'total'].forEach(key => {
      sheet.getColumn(key).numFmt = '"Rs. "#,##0.00';
    });

    if (rows.length > 0) {
      const lastDataRow = sheet.rowCount;
      const totalsRow = sheet.addRow({
        refCode: '', date: '', time: '', name: '', phone: '', email: '',
        street: '', city: '', country: '', book: 'TOTAL',
        qty: { formula: `SUM(K2:K${lastDataRow})` } as any,
        unit: '',
        subtotal: { formula: `SUM(M2:M${lastDataRow})` } as any,
        shipping: { formula: `SUM(N2:N${lastDataRow})` } as any,
        total: { formula: `SUM(O2:O${lastDataRow})` } as any,
        pay: '', status: '', approved: '', delivered: '', notes: '',
      });
      totalsRow.font = { bold: true };
      totalsRow.eachCell((cell) => { cell.border = { top: { style: 'thin' } }; });
    }

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `abadal-whatsapp-orders-${stamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buffer = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buffer as ArrayBuffer));
  }
}
