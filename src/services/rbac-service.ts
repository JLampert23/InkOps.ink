import { supabase } from '../lib/supabase-client';
import { UserRole, UserProfile, RBACPermissions, ROLE_PERMISSIONS } from '../types/rbac';

export class RBACService {
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  static async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      return this.getUserProfile(user.id);
    } catch (error) {
      console.error('Error in getCurrentUserProfile:', error);
      return null;
    }
  }

  static getPermissions(role: UserRole): RBACPermissions {
    return ROLE_PERMISSIONS[role];
  }

  static isSuperAdmin(role: UserRole): boolean {
    return role === 'super_admin';
  }

  static isAdmin(role: UserRole): boolean {
    return role === 'admin';
  }

  static canAccessIntegrations(role: UserRole): boolean {
    return this.getPermissions(role).canAccessIntegrations;
  }

  static hasPermission(role: UserRole, permission: keyof RBACPermissions): boolean {
    return this.getPermissions(role)[permission];
  }
}
