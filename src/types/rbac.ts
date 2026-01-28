export type UserRole = 'super_admin' | 'admin';

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
  },
  admin: {
    canAccessIntegrations: false,
    canAccessDashboard: true,
    canAccessAccounting: true,
    canAccessProduction: true,
    canAccessCustomers: true,
    canAccessReports: true,
    canAccessAutomations: true,
    canAccessSettings: true,
  },
};
