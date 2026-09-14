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
  findSession(tokenHash: string) {
    return this.prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  }
  touchSession(id: string) {
    return this.prisma.session.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }
  revokeSession(tokenHash: string) {
    return this.prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  updateProfile(id: string, data: { username?: string; displayName?: string | null; bio?: string | null }) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.update({ where: { id }, data });
      // Every public profile edit invalidates the prior revision atomically.
      await tx.page.updateMany({ where: { userId: id }, data: {
        ...(data.username !== undefined ? { slug: user.username } : {}), revision: { increment: 1 },
      } });
      return user;
    });
  }
}
