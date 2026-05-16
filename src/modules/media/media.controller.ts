import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private media: MediaService) {}

  /**
   * GET /api/media/upload-signature?folder=abadal
   * Returns the signed params the frontend posts directly to Cloudinary,
   * bypassing our backend for the actual file bytes (saves Railway egress).
   */
  @Get('upload-signature') @Roles('SUPER_ADMIN', 'AUTHOR')
  signature(@Query('folder') folder?: string) {
    return this.media.getSignature(folder || 'abadal');
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
