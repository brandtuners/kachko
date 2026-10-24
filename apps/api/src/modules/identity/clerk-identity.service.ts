import { createClerkClient, verifyToken } from '@clerk/backend';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { IdentityUser } from '@kachko/types';
import { RESERVED_USERNAMES } from '@kachko/validation';
import { IdentityRepository } from './identity.repository';
import { identityError } from './identity.service';

const safeUser = (user: IdentityUser): IdentityUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  displayName: user.displayName,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
  role: user.role,
});

const uniqueError = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

@Injectable()
export class ClerkIdentityService {
  constructor(private readonly repository: IdentityRepository, private readonly config: ConfigService) {}

  async authenticate(token: string): Promise<IdentityUser> {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) identityError(503, 'CLERK_NOT_CONFIGURED', 'Clerk authentication is not configured');

    const verified = await verifyToken(token, {
      secretKey,
      authorizedParties: this.config.getOrThrow<string[]>('CORS_ORIGINS'),
    }).catch(() => undefined);
    if (!verified?.sub) identityError(401, 'UNAUTHENTICATED', 'Sign in to continue');

    let user = await this.repository.findByClerkUserId(verified.sub);
    if (!user) user = await this.provision(verified.sub, secretKey);
    if (!user.isActive || user.deletedAt) identityError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    return safeUser(user);
  }

  async deleteUser(clerkUserId: string): Promise<void> {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) identityError(503, 'CLERK_NOT_CONFIGURED', 'Clerk authentication is not configured');
    await createClerkClient({ secretKey }).users.deleteUser(clerkUserId).catch(() => {
      identityError(502, 'IDENTITY_PROVIDER_ERROR', 'The identity provider could not delete this account');
    });
  }

  private async provision(clerkUserId: string, secretKey: string) {
    const clerk = createClerkClient({ secretKey });
    const remote = await clerk.users.getUser(clerkUserId).catch(() => undefined);
    const primary = remote?.emailAddresses.find(item => item.id === remote.primaryEmailAddressId);
    const email = primary?.emailAddress.trim().toLowerCase();
    if (!remote || !email || primary?.verification?.status !== 'verified') {
      identityError(401, 'CLERK_ACCOUNT_INCOMPLETE', 'A verified email address is required');
    }
    const displayName = [remote.firstName, remote.lastName].filter(Boolean).join(' ').trim() || undefined;
    const profile = { displayName, avatarUrl: remote.imageUrl || undefined };
    const linked = await this.repository.linkClerkUser(clerkUserId, email, profile);
    if (linked) return linked;

    const base = this.usernameBase(remote.username, email);
    const suffix = createHash('sha256').update(clerkUserId).digest('hex').slice(0, 6);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const ending = attempt === 0 ? '' : `-${suffix.slice(0, Math.min(6, attempt + 2))}`;
      const username = `${base.slice(0, 30 - ending.length)}${ending}`;
      try {
        return await this.repository.createClerkUser({ clerkUserId, email, username, ...profile });
      } catch (error) {
        const raced = await this.repository.findByClerkUserId(clerkUserId);
        if (raced) return raced;
        if (!uniqueError(error)) throw error;
      }
    }
    identityError(409, 'USERNAME_UNAVAILABLE', 'Choose a username to finish creating your Kachko account');
  }

  private usernameBase(username: string | null, email: string) {
    let value = (username || email.split('@')[0] || 'creator').toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^[_.-]+|[_.-]+$/g, '')
      .slice(0, 30);
    if (value.length < 3) value = `${value || 'user'}-kachko`.slice(0, 30);
    if ((RESERVED_USERNAMES as readonly string[]).includes(value)) value = `${value}-user`.slice(0, 30);
    return value;
  }
}
