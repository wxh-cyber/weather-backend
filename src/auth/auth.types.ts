import type { User } from '@prisma/client';

export type TokenPayload = {
  sub: string;
  email: string;
  type: string;
  tokenId?: string;
};

export type AuthUser = Pick<
  User,
  | 'userId'
  | 'email'
  | 'nickname'
  | 'phone'
  | 'qq'
  | 'wechat'
  | 'avatarUrl'
  | 'createdAt'
  | 'updatedAt'
>;

export type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
};
