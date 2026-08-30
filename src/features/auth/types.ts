export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  homeRegionCode: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  homeRegion: {
    code: string;
    name: string;
    parentCode: string | null;
  } | null;
  stats: {
    savedGyms: number;
    memberships: number;
    recordsThisMonth: number;
  };
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  displayName: string;
  emailVerificationToken: string;
};

export type EmailVerificationPurpose = 'register' | 'reset_password';

export type PasswordResetInput = {
  password: string;
  emailVerificationToken: string;
};
