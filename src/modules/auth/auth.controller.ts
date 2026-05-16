import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotDto } from './dto/forgot.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetDto } from './dto/reset.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthRateLimit } from '../../common/decorators/throttle-auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private ip(req: any): string {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress
    );
  }

  @Public()
  @AuthRateLimit()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @AuthRateLimit()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto.email, dto.password, this.ip(req));
  }

  @Public()
  @AuthRateLimit()
  @Post('admin-login')
  adminLogin(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.adminLogin(dto.email, dto.password, this.ip(req));
  }

  @Public()
  @AuthRateLimit()
  @Post('forgot-password')
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgotPassword(dto.phone);
  }

  @Public()
  @AuthRateLimit()
  @Post('verify-otp')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @AuthRateLimit()
  @Post('reset-password')
  reset(@Body() dto: ResetDto) {
    return this.auth.resetPassword(dto.tempToken, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }
}
