import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

@Injectable()
export class MediaService {
  private readonly logger = new Logger('Media');
  private cloudinary: any;
  private cloudName?: string;
  private apiKey?: string;
  private apiSecret?: string;

  constructor(private config: ConfigService) {
    const url = config.get<string>('CLOUDINARY_URL');
    // cloudinary://API_KEY:API_SECRET@CLOUD_NAME
    const m = url?.match(/^cloudinary:\/\/(.+?):(.+?)@(.+)$/);
    if (m) {
      this.apiKey = m[1];
      this.apiSecret = m[2];
      this.cloudName = m[3];
      try {
        this.cloudinary = require('cloudinary').v2;
        this.cloudinary.config({ cloud_name: this.cloudName, api_key: this.apiKey, api_secret: this.apiSecret, secure: true });
      } catch {
        this.logger.warn('cloudinary package not installed — falling back to local /uploads');
      }
    }
  }

  /**
   * Direct-browser upload signature.
   * The frontend posts the file directly to Cloudinary; our backend never sees the bytes.
   * This saves egress bandwidth on Railway and reduces compute cost.
   */
  getSignature(folder = 'abadal') {
    if (!this.cloudinary || !this.apiSecret) {
      throw new BadRequestException('Cloudinary not configured. Set CLOUDINARY_URL env var.');
    }
    const timestamp = Math.round(Date.now() / 1000);
    // Sign exactly the params the client will send (folder + timestamp), excluding api_key & file
    const toSign = `folder=${folder}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');
    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
    };
  }

  async upload(file: Express.Multer.File): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed');
    }
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Max 5MB');

    if (this.cloudinary) {
      return new Promise((resolve, reject) => {
        const stream = this.cloudinary.uploader.upload_stream(
          { folder: 'abadal', resource_type: 'image' },
          (err: any, result: any) => {
            if (err) return reject(err);
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        );
        stream.end(file.buffer);
      });
    }
    const dir = path.resolve('uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname) || '';
    const id = `${uuid()}${ext}`;
    fs.writeFileSync(path.join(dir, id), file.buffer);
    return { url: `/uploads/${id}`, publicId: id };
  }

  async remove(publicId: string) {
    if (this.cloudinary) {
      await this.cloudinary.uploader.destroy(publicId);
    } else {
      const p = path.resolve('uploads', publicId);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return { success: true };
  }
}
