import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { ZodBodyPipe, ZodQueryPipe } from '../../common/pipes';
import { JwtAuthGuard, UserStatusGuard, RolesGuard, OwnerOrPermissionGuard } from '../../common/guards';
import { CurrentUser, Roles, Permissions } from '../../common/decorators';
import { updateUserSchema, UpdateUserDto } from './schemas/user.schema';
import { cursorPaginationSchema, CursorPaginationParams } from '../../common/utils/pagination.util';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, UserStatusGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'List all users (admin, cursor pagination)' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Cursor for pagination' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Items per page (1-100, default 20)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async findAll(@Query(new ZodQueryPipe(cursorPaginationSchema)) query: CursorPaginationParams) {
    return this.userService.findAllCursor(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser() user: Record<string, unknown>) {
    return this.userService.findById(user.id as string);
  }

  @Get(':id')
  @UseGuards(OwnerOrPermissionGuard)
  @Permissions('user:read')
  @ApiOperation({ summary: 'Get user by ID (owner or user:read permission)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @UseGuards(OwnerOrPermissionGuard)
  @Permissions('user:write')
  @ApiOperation({ summary: 'Update user (owner or user:write permission)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'New Name' },
        email: { type: 'string', format: 'email', example: 'new@example.com' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body(new ZodBodyPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Soft delete user (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User soft deleted' })
  async remove(@Param('id') id: string) {
    return this.userService.softDelete(id);
  }
}
