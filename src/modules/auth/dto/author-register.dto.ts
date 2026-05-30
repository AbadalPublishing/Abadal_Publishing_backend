import { IsEmail, IsOptional, IsString, MinLength, MaxLength, IsArray, IsUrl, Length, IsObject } from 'class-validator';

export class AuthorRegisterDto {
  // Basic
  @IsString() @Length(1, 60)  firstName!: string;
  @IsString() @Length(1, 60)  lastName!: string;
  @IsEmail()                  email!: string;
  @IsString() @MinLength(8) @MaxLength(120) password!: string;
  @IsOptional() @IsString() @Length(7, 20) phone?: string;

  // Author identity
  @IsString() @Length(2, 80)  penName!: string;
  @IsString() @Length(20, 2000) bio!: string;
  @IsArray() @IsString({ each: true }) languages!: string[];

  // Optional public-profile fields
  @IsOptional() @IsString() @IsUrl() photo?: string;
  @IsOptional() @IsString() @IsUrl() website?: string;
  @IsOptional() @IsString() @MaxLength(60) nationality?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}
