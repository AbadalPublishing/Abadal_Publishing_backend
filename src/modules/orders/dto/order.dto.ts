import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) quantity: number;
  @IsEnum(['RETAIL', 'WHOLESALE', 'STUDENT']) priceType: any;
}

export class CreateOrderDto {
  @IsString() addressId: string;
  @IsOptional() @IsEnum(['TRAX', 'LEOPARDS']) courier?: any;
  @IsEnum(['COD', 'JAZZCASH', 'EASYPAISA', 'CARD', 'BANK_TRANSFER']) paymentMethod: any;
  @IsOptional() @IsString() couponCode?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @IsOptional() @IsString() notes?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'FAILED'])
  status: any;
}
