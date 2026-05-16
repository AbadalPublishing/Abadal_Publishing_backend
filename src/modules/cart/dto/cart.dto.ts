import { IsArray, IsEnum, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) quantity: number;
  @IsEnum(['RETAIL', 'WHOLESALE', 'STUDENT']) priceType: any;
}

export class UpdateCartDto {
  @IsInt() @Min(1) quantity: number;
}

export class MergeCartDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => AddCartDto) items: AddCartDto[];
}
