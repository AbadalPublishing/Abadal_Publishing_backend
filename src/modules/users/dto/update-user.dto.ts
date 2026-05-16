import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsEnum(['SUPER_ADMIN', 'AUTHOR', 'CUSTOMER']) role?: any;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() city?: string;
}
