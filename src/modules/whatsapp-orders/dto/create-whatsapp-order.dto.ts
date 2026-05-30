import { IsString, IsOptional, IsEmail, IsInt, Min, Max, IsNumber, Length, MaxLength, IsIn, IsUrl } from 'class-validator';

export class CreateWhatsappOrderDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Length(7, 20) phone!: string;
  @IsOptional() @IsEmail() email?: string;

  @IsString() @Length(3, 240) street!: string;
  @IsString() @Length(2, 60)  city!: string;
  @IsOptional() @IsString() @Length(2, 60) country?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @IsOptional() @IsString() productId?: string;
  @IsString() @Length(1, 240) bookTitle!: string;
  @IsOptional() @IsString() @Length(1, 40) edition?: string;

  @IsInt() @Min(1) @Max(99) quantity!: number;
  @IsNumber() @Min(0)       unitPrice!: number;

  // Payment proof — required per business rule
  @IsString() @IsIn(['JAZZCASH', 'EASYPAISA']) paymentMethod!: string;
  @IsString() @IsUrl() paymentReceiptUrl!: string;
}
