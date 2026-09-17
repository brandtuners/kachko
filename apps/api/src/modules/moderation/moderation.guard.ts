import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { identityError } from '../identity/identity.service';
import type { IdentityRequest } from '../identity/identity.guards';

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const user = await this.prisma.user.findUnique({ where: { id: request.identity.id }, select: { role: true, isActive: true, deletedAt: true } });
    if (!user?.isActive || user.deletedAt || !['MODERATOR', 'ADMIN'].includes(user.role)) {
      identityError(403, 'FORBIDDEN', 'Moderator access is required');
    }
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const user = await this.prisma.user.findUnique({ where: { id: request.identity.id }, select: { role: true, isActive: true, deletedAt: true } });
    if (!user?.isActive || user.deletedAt || user.role !== 'ADMIN') identityError(403, 'FORBIDDEN', 'Administrator access is required');
    return true;
  }
}
