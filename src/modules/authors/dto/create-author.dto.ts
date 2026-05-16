import { IsArray, IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAuthorDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() penName: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() socialLinks?: any;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsArray() languages?: string[];
  @IsOptional() @IsNumber() royaltyPercentage?: number;
}
