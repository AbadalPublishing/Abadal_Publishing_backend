import { IsEmail, IsOptional, IsString, MinLength, IsDateString } from 'class-validator';

export class RegisterDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
}
