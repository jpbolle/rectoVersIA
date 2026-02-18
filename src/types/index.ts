export type UserRole = 'prof' | 'eleve';

export interface UserProfile {
  email: string;
  role: UserRole;
  displayName: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

// Re-export devoir types
export * from './devoir';
