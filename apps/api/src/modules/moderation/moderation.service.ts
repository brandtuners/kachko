import { Injectable } from '@nestjs/common';
import type { CreateReportInput, ReportStatusUpdateInput, UserStatusUpdateInput, DeleteAccountInput } from '@kachko/validation';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../../database/prisma.service';
import { MediaStorage } from '../media/media.storage';
import { identityError } from '../identity/identity.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService, private readonly storage: MediaStorage) {}

  async createReport(input: CreateReportInput) {
    const page = await this.prisma.page.findFirst({ where: { id: input.pageId, isPublished: true, user: { isActive: true, deletedAt: null } }, select: { id: true } });
    if (!page) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    await this.prisma.report.create({ data: input });
    return { data: { accepted: true as const } };
  }

  async reports(status: 'OPEN' | 'RESOLVED' | 'REJECTED') {
    const rows = await this.prisma.report.findMany({
      where: { status }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { page: { select: { id: true, slug: true, user: { select: { id: true, username: true, isActive: true } } } }, reporter: { select: { username: true } } },
    });
    return { data: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: undefined, pageId: undefined, reporterId: undefined, handledById: undefined, handledAt: undefined })) };
  }

  async updateReport(actorId: string, id: string, input: ReportStatusUpdateInput) {
    const report = await this.prisma.$transaction(async tx => {
      const updated = await tx.report.update({ where: { id }, data: { status: input.status, handledById: actorId, handledAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'REPORT_STATUS_CHANGED', entityType: 'Report', entityId: id, metadata: { status: input.status } } });
      return updated;
    }).catch((error: unknown) => {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2025') identityError(404, 'REPORT_NOT_FOUND', 'Report not found');
      throw error;
    });
    return { data: { id: report.id, status: report.status } };
  }

  async updateUserStatus(actorId: string, userId: string, input: UserStatusUpdateInput) {
    if (actorId === userId) identityError(400, 'SELF_MODERATION_REJECTED', 'You cannot change your own status');
    return this.prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!target) identityError(404, 'USER_NOT_FOUND', 'User not found');
      if (target.role === 'ADMIN') identityError(403, 'FORBIDDEN', 'Administrator accounts cannot be moderated here');
      await tx.user.update({ where: { id: userId }, data: { isActive: input.isActive } });
      if (!input.isActive) {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.page.updateMany({ where: { userId }, data: { isPublished: false, publishedAt: null, revision: { increment: 1 } } });
      }
      await tx.auditLog.create({ data: { actorId, action: input.isActive ? 'USER_REACTIVATED' : 'USER_SUSPENDED', entityType: 'User', entityId: userId } });
      return { data: { id: userId, isActive: input.isActive } };
    });
  }

  async auditLogs() {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { username: true } } } });
    return { data: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  }

  async deleteAccount(userId: string, input: DeleteAccountInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, media: { select: { storageKey: true } } } });
    if (!user) identityError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.passwordHash && (!input.password || !await verify(user.passwordHash, input.password))) {
      identityError(401, 'INVALID_CREDENTIALS', 'Your password is incorrect');
    }
    const storageKeys = user.media.map(item => item.storageKey);
    await this.prisma.$transaction(async tx => {
      await tx.auditLog.create({ data: { action: 'ACCOUNT_DELETED', entityType: 'User', entityId: userId } });
      await tx.user.update({ where: { id: userId }, data: { avatarMediaId: null } });
      await tx.user.delete({ where: { id: userId } });
    });
    await Promise.allSettled(storageKeys.map(key => this.storage.delete(key)));
    return { data: { deleted: true as const } };
  }
}
