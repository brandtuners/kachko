import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findGoogle(subject: string) {
    return this.prisma.googleAccount.findUnique({ where: { subject }, include: { user: true } });
  }
  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username }, select: { id: true } });
  }
  register(data: Prisma.UserCreateInput, tokenHash: string, expiresAt: Date, previousHash?: string) {
    return this.prisma.$transaction(async tx => {
      if (previousHash) await tx.session.updateMany({ where: { tokenHash: previousHash, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.user.create({ data: { ...data, sessions: { create: { tokenHash, expiresAt } } } });
    });
  }
  createSession(userId: string, tokenHash: string, expiresAt: Date, previousHash?: string) {
    return this.prisma.$transaction(async tx => {
      if (previousHash) await tx.session.updateMany({ where: { tokenHash: previousHash, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.session.create({ data: { userId, tokenHash, expiresAt } });
    });
  }
  async linkGoogle(userId: string, subject: string, email: string) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isActive: true, deletedAt: true } });
      if (!user?.isActive || user.deletedAt || user.email !== email) return null;
      await tx.googleAccount.create({ data: { userId, subject } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'GOOGLE_ACCOUNT_LINKED', entityType: 'User', entityId: userId } });
      return user;
    });
  }
  findSession(tokenHash: string) {
    return this.prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  }
  touchSession(id: string) {
    return this.prisma.session.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }
  revokeSession(tokenHash: string) {
    return this.prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  async createPasswordReset(email: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, deletedAt: true, passwordHash: true } });
      if (!user?.isActive || user.deletedAt || !user.passwordHash) return null;
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
      return { email: user.email };
    });
  }
  async resetPassword(tokenHash: string, passwordHash: string) {
    return this.prisma.$transaction(async tx => {
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, usedAt: true, expiresAt: true } });
      if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return false;
      const consumed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
  }
  updateProfile(id: string, data: { username?: string; displayName?: string | null; bio?: string | null }) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.update({ where: { id }, data });
      // Every public profile edit invalidates the prior revision atomically.
      await tx.page.updateMany({ where: { userId: id }, data: { revision: { increment: 1 } } });
      return user;
    });
  }
}
