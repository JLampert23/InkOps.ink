export type UserRole = 'super_admin' | 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface RBACPermissions {
  canAccessIntegrations: boolean;
  canAccessDashboard: boolean;
  canAccessAccounting: boolean;
  canAccessProduction: boolean;
  canAccessCustomers: boolean;
  canAccessReports: boolean;
  canAccessAutomations: boolean;
  canAccessSettings: boolean;
  canViewPricing: boolean;
  canAccessAccountSettings: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RBACPermissions> = {
  super_admin: {
    canAccessIntegrations: true,
    canAccessDashboard: true,
    canAccessAccounting: true,
    canAccessProduction: true,
    canAccessCustomers: true,
    canAccessReports: true,
    canAccessAutomations: true,
    canAccessSettings: true,
    canViewPricing: true,
    canAccessAccountSettings: true,
  },
  admin: {
    canAccessIntegrations: true,
    canAccessDashboard: true,
    canAccessAccounting: true,
    canAccessProduction: true,
    canAccessCustomers: true,
    canAccessReports: true,
    canAccessAutomations: true,
    canAccessSettings: false,
    canViewPricing: true,
    canAccessAccountSettings: false,
  },
  user: {
    canAccessIntegrations: false,
    canAccessDashboard: false,
    canAccessAccounting: false,
    canAccessProduction: true,
    canAccessCustomers: false,
    canAccessReports: false,
    canAccessAutomations: false,
    canAccessSettings: false,
    canViewPricing: false,
    canAccessAccountSettings: false,
  },
};
