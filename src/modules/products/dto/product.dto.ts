import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class VariantDto {
  @IsEnum(['PAPERBACK', 'HARDCOVER', 'EBOOK']) type: any;
  @IsOptional() @IsString() isbn?: string;
  @IsOptional() @IsString() sku?: string;
  @IsNumber() retailPrice: number;
  @IsNumber() wholesalePrice: number;
  @IsNumber() studentPrice: number;
  @IsOptional() @IsNumber() listPrice?: number;
  @IsOptional() @IsNumber() stock?: number;
  @IsOptional() @IsNumber() lowStockThreshold?: number;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsNumber() length?: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsNumber() royaltyPercentage?: number;
  @IsOptional() @IsBoolean() amazonOnly?: boolean;
}

export class CreateProductDto {
  @IsString() title: string;
  @IsEnum(['BOOK', 'EBOOK', 'MAGAZINE', 'COURSE']) type: any;
  @IsOptional() @IsString() language?: string;
  @IsString() description: string;
  @IsOptional() @IsString() authorBio?: string;
  @IsOptional() tableOfContents?: any;
  @IsOptional() @IsString() editorialNote?: string;
  @IsOptional() @IsString() pullQuote?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsString() ogTitle?: string;
  @IsOptional() @IsString() ogDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() awards?: any;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() isbn?: string;
  @IsOptional() @IsString() publisher?: string;
  @IsOptional() @IsString() publishedDate?: string;
  @IsOptional() @IsNumber() pages?: number;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsDateString() featuredUntil?: string;
  @IsOptional() @IsString() amazonUrl?: string;
  @IsOptional() @IsBoolean() whatsappEnabled?: boolean;
  @IsOptional() @IsString() authorId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional() @IsString() declare title: string;
  @IsOptional() declare type: any;
  @IsOptional() @IsString() declare description: string;
}

export class FeaturedDto {
  @IsBoolean() isFeatured: boolean;
  @IsOptional() @IsDateString() featuredUntil?: string;
}
