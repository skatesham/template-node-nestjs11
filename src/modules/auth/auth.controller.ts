import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ZodBodyPipe } from '../../common/pipes';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { registerSchema, loginSchema, refreshSchema, RegisterDto, LoginDto, RefreshDto } from './schemas/auth.schema';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: { type: 'string', minLength: 8, example: 'MyP@ssw0rd' },
        name: { type: 'string', example: 'John Doe' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User registered', schema: { properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'string' } } } })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body(new ZodBodyPipe(registerSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'admin@template.com' },
        password: { type: 'string', example: 'Admin@123' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful', schema: { properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'string' } } } })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body(new ZodBodyPipe(loginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'your-refresh-token-here' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body(new ZodBodyPipe(refreshSchema)) dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'your-refresh-token-here' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Body(new ZodBodyPipe(refreshSchema)) dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
