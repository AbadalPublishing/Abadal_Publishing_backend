import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private sanitize(user: any) {
    if (!user) return user;
    const { password, ...rest } = user;
    return rest;
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already registered');
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hash,
        phone: dto.phone,
        city: dto.city,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        role: 'CUSTOMER',
      },
    });
    return this.issueToken(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    const ok = await bcrypt.compare(password, user.password);
    return ok ? user : null;
  }

  async login(email: string, password: string, ip?: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });
    return this.issueToken(user);
  }

  async adminLogin(email: string, password: string, ip?: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Not an admin');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });
    return this.issueToken(user);
  }

  private issueToken(user: any) {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role, email: user.email });
    return { user: this.sanitize(user), accessToken };
  }

  async forgotPassword(phone: string) {
    const user = await this.prisma.user.findFirst({ where: { phone } });
    // do not leak existence — always respond same shape
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { hashOtp } = await import('../../common/utils/crypto.util');
    await this.prisma.otp.create({
      data: {
        phone,
        code: hashOtp(code), // store HMAC-SHA256, never plain
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    // In production the plain `code` would be sent via SMS provider here.
    // devCode only returned in non-production to ease testing.
    return {
      success: true,
      message: 'OTP sent if account exists',
      devCode: process.env.NODE_ENV !== 'production' && user ? code : undefined,
    };
  }

  async verifyOtp(phone: string, code: string) {
    const { hashOtp } = await import('../../common/utils/crypto.util');
    const hashed = hashOtp(code);
    const otp = await this.prisma.otp.findFirst({
      where: { phone, code: hashed, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');
    await this.prisma.otp.update({ where: { id: otp.id }, data: { used: true } });
    const tempToken = this.jwt.sign({ phone, purpose: 'reset' }, { expiresIn: '15m' });
    return { tempToken };
  }

  async resetPassword(tempToken: string, newPassword: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(tempToken);
    } catch {
      throw new BadRequestException('Invalid token');
    }
    if (payload.purpose !== 'reset' || !payload.phone) throw new BadRequestException('Invalid token');
    const user = await this.prisma.user.findFirst({ where: { phone: payload.phone } });
    if (!user) throw new BadRequestException('User not found');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: hash } });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { author: true },
    });
    return this.sanitize(user);
  }
}
