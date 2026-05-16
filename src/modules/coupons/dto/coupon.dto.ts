import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCouponDto {
  @IsString() code: string;
  @IsEnum(['PERCENTAGE', 'FIXED']) type: any;
  @IsNumber() value: number;
  @IsOptional() @IsInt() maxUses?: number;
  @IsOptional() @IsBoolean() onePerCustomer?: boolean;
  @IsDateString() validFrom: string;
  @IsDateString() validUntil: string;
  @IsOptional() @IsNumber() minOrderValue?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ValidateCouponDto {
  @IsString() code: string;
  @IsNumber() orderTotal: number;
}
