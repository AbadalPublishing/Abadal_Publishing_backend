import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { WriteRateLimit } from '../../common/decorators/throttle-auth.decorator';

// Folders any visitor can upload to without authentication
// (customer-facing flows like WhatsApp payment receipts).
const PUBLIC_UPLOAD_FOLDERS = ['abadal/wa-receipts'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'AUTHOR'];

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private media: MediaService, private jwt: JwtService) {}

  /**
   * GET /api/media/upload-signature?folder=abadal
   *
   * Returns signed Cloudinary params. The folder controls who can call this:
   *   - PUBLIC_UPLOAD_FOLDERS  → anyone (customers uploading payment receipts, etc.)
   *   - any other folder       → must be SUPER_ADMIN or AUTHOR
   */
  @Public()
  @Get('upload-signature')
  @WriteRateLimit()
  signature(@Query('folder') folder: string | undefined, @Req() req: Request) {
    const f = folder || 'abadal';
    if (PUBLIC_UPLOAD_FOLDERS.includes(f)) {
      return this.media.getSignature(f);
    }
    // Non-public folder — manually verify JWT and role
    const authHeader = (req.headers?.authorization || '') as string;
    if (!authHeader.startsWith('Bearer ')) throw new ForbiddenException('Authentication required');
    let payload: any;
    try { payload = this.jwt.verify(authHeader.slice(7)); }
    catch { throw new ForbiddenException('Invalid or expired token'); }
    if (!ADMIN_ROLES.includes(payload?.role)) throw new ForbiddenException('Not allowed for this folder');
    return this.media.getSignature(f);
  }

  /** Fallback: server-side upload (used if Cloudinary not configured). */
  @Post('upload') @Roles('SUPER_ADMIN', 'AUTHOR')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.media.upload(file);
  }

  @Delete(':publicId') @Roles('SUPER_ADMIN')
  remove(@Param('publicId') publicId: string) {
    return this.media.remove(publicId);
  }
}
