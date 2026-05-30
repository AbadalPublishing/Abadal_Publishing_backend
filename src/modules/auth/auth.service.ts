import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { AuthorRegisterDto } from './dto/author-register.dto';
import { UpgradeToAuthorDto } from './dto/upgrade-to-author.dto';
import { slugify } from '../../common/utils/slug';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private email: EmailService, private config: ConfigService) {}

  private sanitize(user: any) {
    if (!user) return user;
    const { password, ...rest } = user;
    return rest;
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (exists) throw new BadRequestException('Email already registered');
    await this.releaseSoftDeletedEmail(dto.email);
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

  async registerAuthor(dto: AuthorRegisterDto) {
    const exists = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (exists) throw new BadRequestException('Email already registered');
    await this.releaseSoftDeletedEmail(dto.email);

    // Generate unique slug from penName
    let baseSlug = slugify(dto.penName) || 'author';
    let slug = baseSlug;
    for (let i = 1; i < 25; i++) {
      const clash = await this.prisma.author.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${i + 1}`;
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: hash,
          phone: dto.phone,
          role: 'AUTHOR',
          isActive: false,           // inactive until email verified
          emailVerified: false,
          emailVerificationToken: token,
          emailVerificationExpiresAt: expiresAt,
        } as any,
      });
      await tx.author.create({
        data: {
          userId: user.id,
          slug,
          penName: dto.penName,
          bio: dto.bio,
          photo: dto.photo,
          website: dto.website,
          nationality: dto.nationality,
          languages: dto.languages,
          socialLinks: dto.socialLinks as any,
          isVerified: false,
        },
      });
      return user;
    });

    // Build verify URL — frontend will route /verify-email and POST the token
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    await this.email.sendAuthorWelcome(created, verifyUrl);

    return {
      success: true,
      message: 'Check your email for a verification link to activate your author account.',
      email: created.email,
    };
  }

  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Verification token required');
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token } as any,
    });
    if (!user) throw new NotFoundException('Invalid or already-used verification link');
    const uAny = user as any;
    if (uAny.emailVerificationExpiresAt && new Date(uAny.emailVerificationExpiresAt) < new Date()) {
      throw new BadRequestException('Verification link has expired');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: true,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiresAt: null,
        } as any,
      });
      // Auto-approve author if there is one linked to this user
      const author = await tx.author.findUnique({ where: { userId: user.id } });
      if (author) {
        await tx.author.update({ where: { id: author.id }, data: { isVerified: true } });
      }
    });
    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    return this.issueToken(fresh);
  }

  async upgradeToAuthor(userId: string, dto: UpgradeToAuthorDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { author: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.author) throw new BadRequestException('You already have an author profile');

    // SECURITY: require verified email before allowing role upgrade to AUTHOR.
    // If not verified, mint a new verification token and email them — return a clear error.
    if (!user.emailVerified) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerificationToken: token, emailVerificationExpiresAt: expiresAt } as any,
      });
      const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const verifyUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
      try { await this.email.sendAuthorWelcome(user, verifyUrl); } catch { /* ignore — error still surfaces */ }
      throw new BadRequestException(
        'Please verify your email first. We just sent a verification link to ' + user.email + '.',
      );
    }

    // Generate unique slug from penName
    let baseSlug = slugify(dto.penName) || 'author';
    let slug = baseSlug;
    for (let i = 1; i < 25; i++) {
      const clash = await this.prisma.author.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${i + 1}`;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { role: 'AUTHOR' },
      });
      await tx.author.create({
        data: {
          userId,
          slug,
          penName: dto.penName,
          bio: dto.bio,
          photo: dto.photo,
          website: dto.website,
          nationality: dto.nationality,
          languages: dto.languages,
          socialLinks: dto.socialLinks as any,
          // Auto-verify since their email is already verified as a customer
          isVerified: user.emailVerified,
        },
      });
      return updatedUser;
    });

    return this.issueToken(result);
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

  /** If a soft-deleted user holds this email, mangle theirs to free the @unique slot. */
  private async releaseSoftDeletedEmail(email: string) {
    const ghost = await this.prisma.user.findFirst({
      where: { email, deletedAt: { not: null } },
    });
    if (ghost) {
      await this.prisma.user.update({
        where: { id: ghost.id },
        data: { email: `deleted_${Date.now()}_${ghost.email}` },
      });
    }
  }
}
