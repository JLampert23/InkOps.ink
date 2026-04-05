import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { useAuth } from './AuthContext';
import { SubscriptionTier, SubscriptionStatus, TIER_FEATURES } from '../types/subscription';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  loading: boolean;
  canAccess: (feature: keyof typeof TIER_FEATURES) => boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('starter');
  const [status, setStatus] = useState<SubscriptionStatus>('trialing');
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setTier('starter');
      setStatus('trialing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // First get company_id from user_profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.company_id) {
        // Then get subscription info from company_settings
        const { data: settings } = await supabase
          .from('company_settings')
          .select('subscription_tier, subscription_status')
          .eq('id', profile.company_id)
          .maybeSingle();

        if (settings) {
          setTier((settings.subscription_tier as SubscriptionTier) || 'starter');
          setStatus((settings.subscription_status as SubscriptionStatus) || 'trialing');
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const canAccess = (feature: keyof typeof TIER_FEATURES): boolean => {
    // Super admins could potentially bypass this, but for now we enforce strictly
    // based on company tier.
    const requiredTier = TIER_FEATURES[feature];
    
    if (requiredTier === 'starter') return true;
    
    // If it requires professional, user MUST be professional.
    if (requiredTier === 'professional' && tier === 'professional') return true;
    
    return false;
  };

  return (
    <SubscriptionContext.Provider value={{
      tier,
      status,
      loading,
      canAccess,
      refreshSubscription: fetchSubscription
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
