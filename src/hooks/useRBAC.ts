import { useState, useEffect } from 'react';
import { UserRole, UserProfile, RBACPermissions } from '../types/rbac';
import { RBACService } from '../services/rbac-service';
import { useAuth } from '../contexts/AuthContext';

export function useRBAC() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RBACPermissions | null>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    } else {
      setUserProfile(null);
      setPermissions(null);
      setLoading(false);
    }
  }, [user]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const profile = await RBACService.getCurrentUserProfile();
      setUserProfile(profile);

      if (profile) {
        setPermissions(RBACService.getPermissions(profile.role));
      } else {
        setPermissions(null);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = userProfile ? RBACService.isSuperAdmin(userProfile.role) : false;
  const isAdmin = userProfile ? RBACService.isAdmin(userProfile.role) : false;
  const role = userProfile?.role || null;

  const hasPermission = (permission: keyof RBACPermissions): boolean => {
    if (!permissions) return false;
    return permissions[permission];
  };

  return {
    userProfile,
    role,
    permissions,
    loading,
    isSuperAdmin,
    isAdmin,
    hasPermission,
    canAccessIntegrations: permissions?.canAccessIntegrations || false,
    refreshProfile: loadUserProfile,
  };
}
