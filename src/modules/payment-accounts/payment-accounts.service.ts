import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from './dto/payment-account.dto';
import { encrypt, decrypt, maskAccount } from '../../common/utils/crypto.util';

/**
 * Account numbers are stored AES-256-GCM encrypted at rest.
 * On read, we decrypt + return either the full plain value (to the owner)
 * or a masked •••• 1234 (to other contexts via `customerFacing`).
 */
@Injectable()
export class PaymentAccountsService {
  constructor(private prisma: PrismaService) {}

  private decryptRow(a: any, masked = false) {
    if (!a) return a;
    const dec = decrypt(a.accountNumber);
    return {
      ...a,
      accountNumber: masked ? maskAccount(dec || '') : (dec ?? a.accountNumber),
    };
  }

  async list(user: any) {
    const rows = await this.prisma.paymentAccount.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    // Owner sees plain text (they need to copy/edit it)
    return rows.map(r => this.decryptRow(r));
  }

  async customerFacing() {
    const admin = await this.prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!admin) return [];
    const rows = await this.prisma.paymentAccount.findMany({
      where: { ownerId: admin.id, isCustomerFacing: true, isActive: true },
      select: { id: true, type: true, accountTitle: true, accountNumber: true, bankName: true },
    });
    // Customers see masked (••••) numbers — they get the full number only on order confirmation page
    return rows.map(r => this.decryptRow(r, true));
  }

  async create(user: any, dto: CreatePaymentAccountDto) {
    if (dto.isCustomerFacing && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only admins can mark customer-facing');
    }
    const dup = await this.prisma.paymentAccount.findUnique({
      where: { ownerId_type: { ownerId: user.id, type: dto.type } },
    });
    if (dup) throw new BadRequestException('Account of this type already exists');
    if (dto.isDefault) {
      await this.prisma.paymentAccount.updateMany({ where: { ownerId: user.id }, data: { isDefault: false } });
    }
    const encrypted = encrypt(dto.accountNumber)!;
    const created = await this.prisma.paymentAccount.create({
      data: {
        ...dto,
        accountNumber: encrypted,
        ownerId: user.id,
        isCustomerFacing: user.role === 'SUPER_ADMIN' ? !!dto.isCustomerFacing : false,
      },
    });
    return this.decryptRow(created);
  }

  private async own(user: any, id: string) {
    const a = await this.prisma.paymentAccount.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.ownerId !== user.id) throw new ForbiddenException();
    return a;
  }

  async update(user: any, id: string, dto: UpdatePaymentAccountDto) {
    await this.own(user, id);
    if (dto.isCustomerFacing && user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    const data: any = { ...dto };
    if (dto.accountNumber) data.accountNumber = encrypt(dto.accountNumber);
    const updated = await this.prisma.paymentAccount.update({ where: { id }, data });
    return this.decryptRow(updated);
  }

  async remove(user: any, id: string) {
    await this.own(user, id);
    await this.prisma.paymentAccount.delete({ where: { id } });
    return { success: true };
  }

  async setDefault(user: any, id: string) {
    await this.own(user, id);
    await this.prisma.paymentAccount.updateMany({ where: { ownerId: user.id }, data: { isDefault: false } });
    const updated = await this.prisma.paymentAccount.update({ where: { id }, data: { isDefault: true } });
    return this.decryptRow(updated);
  }
}
