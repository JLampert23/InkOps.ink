import { supabase } from '../lib/supabase-client';
import { UserRole, UserProfile, RBACPermissions, ROLE_PERMISSIONS } from '../types/rbac';

export class RBACService {
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('Fetching user profile from database for user ID:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        console.error('Error details:', JSON.stringify(error));
        return null;
      }

      console.log('Profile data from DB:', data);
      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  static async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('Error getting user:', userError);
        return null;
      }

      if (!user) {
        console.log('No user logged in');
        return null;
      }

      console.log('Fetching profile for user:', user.id, user.email);
      const profile = await this.getUserProfile(user.id);
      console.log('User profile loaded:', profile);
      return profile;
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
