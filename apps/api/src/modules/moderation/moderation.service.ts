import { Injectable } from '@nestjs/common';
import type { AdminListQueryInput, AdminPageStatusUpdateInput, CreateReportInput, ReportStatusUpdateInput, UserStatusUpdateInput, DeleteAccountInput } from '@kachko/validation';
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
      include: { page: { select: { id: true, slug: true, isPrimary: true, user: { select: { id: true, username: true, isActive: true } } } }, reporter: { select: { username: true } } },
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

  async adminUsers(input: AdminListQueryInput) {
    const q = input.q?.trim();
    const rows = await this.prisma.user.findMany({
      where: q ? { OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ] } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, username: true, displayName: true, avatarUrl: true,
        role: true, isActive: true, isVerified: true, deletedAt: true, createdAt: true,
        pages: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { id: true, slug: true, isPrimary: true, isPublished: true } },
        _count: { select: { sessions: true, reports: true } },
      },
    });
    return { data: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null })) };
  }

  async adminPages(input: AdminListQueryInput) {
    const q = input.q?.trim();
    const rows = await this.prisma.page.findMany({
      where: q ? { OR: [
        { slug: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { user: { username: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ] } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, isPrimary: true, title: true, description: true, isPublished: true,
        publishedAt: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, username: true, email: true, isActive: true } },
        _count: { select: { blocks: true, reports: true, analytics: true } },
      },
    });
    return { data: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), publishedAt: row.publishedAt?.toISOString() ?? null })) };
  }

  async updatePageStatus(actorId: string, pageId: string, input: AdminPageStatusUpdateInput) {
    return this.prisma.$transaction(async tx => {
      const page = await tx.page.findUnique({ where: { id: pageId }, select: { id: true, isPublished: true } });
      if (!page) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
      const updated = await tx.page.update({ where: { id: pageId }, data: {
        isPublished: input.isPublished,
        publishedAt: input.isPublished ? undefined : null,
        revision: { increment: 1 },
      } });
      await tx.auditLog.create({ data: { actorId, action: 'PAGE_UNPUBLISHED', entityType: 'Page', entityId: pageId } });
      return { data: { id: updated.id, isPublished: updated.isPublished } };
    });
  }

  async deleteUserAsAdmin(actorId: string, userId: string) {
    if (actorId === userId) identityError(400, 'SELF_MODERATION_REJECTED', 'You cannot delete your own administrator account');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, media: { select: { storageKey: true } } } });
    if (!user) identityError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.role === 'ADMIN') identityError(403, 'FORBIDDEN', 'Administrator accounts cannot be deleted here');
    const storageKeys = user.media.map(item => item.storageKey);
    await this.prisma.$transaction(async tx => {
      await tx.auditLog.create({ data: { actorId, action: 'ACCOUNT_DELETED_BY_ADMIN', entityType: 'User', entityId: userId } });
      await tx.user.update({ where: { id: userId }, data: { avatarMediaId: null } });
      await tx.user.delete({ where: { id: userId } });
    });
    await Promise.allSettled(storageKeys.map(key => this.storage.delete(key)));
    return { data: { deleted: true as const } };
  }

  async adminHealth() {
    const [users, pages, publishedPages, openReports] = await this.prisma.$transaction([
      this.prisma.user.count(), this.prisma.page.count(),
      this.prisma.page.count({ where: { isPublished: true } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
    ]);
    return { data: { status: 'ok' as const, users, pages, publishedPages, openReports } };
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
