import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { signUpCompany, CompanySignupData, getCompanySettings, CompanySettings } from '../services/auth-service';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  company_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  companySettings: CompanySettings | null;
  refreshCompanySettings: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithCompany: (data: CompanySignupData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const initRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, role, company_id')
        .eq('id', userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (mountedRef.current) setUserProfile(null);
    }
  }, []);

  const refreshCompanySettings = useCallback(async () => {
    try {
      const settings = await getCompanySettings();
      if (mountedRef.current) setCompanySettings(settings);
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let timeoutId: ReturnType<typeof setTimeout>;

    const initAuth = async () => {
      timeoutId = setTimeout(() => {
        if (mountedRef.current && loading) {
          console.warn('Auth initialization timeout - forcing ready state');
          setLoading(false);
        }
      }, 5000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await Promise.all([
            refreshUserProfile(session.user.id),
            refreshCompanySettings()
          ]).catch(err => console.error('Error loading user data:', err));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        clearTimeout(timeoutId);
        if (mountedRef.current) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        Promise.all([
          refreshUserProfile(session.user.id),
          refreshCompanySettings()
        ]).catch(err => console.error('Error in auth state change:', err));
      } else {
        setUserProfile(null);
        setCompanySettings(null);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loading, refreshUserProfile, refreshCompanySettings]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  }, []);

  const signUpWithCompany = useCallback(async (data: CompanySignupData) => {
    const result = await signUpCompany(data);
    if (!result.error) {
      await refreshCompanySettings();
    }
    return result;
  }, [refreshCompanySettings]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Sign out API call failed, but clearing local session anyway:', error);
    }

    setSession(null);
    setUser(null);
    setUserProfile(null);
    setCompanySettings(null);

    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    userProfile,
    loading,
    companySettings,
    refreshCompanySettings,
    signIn,
    signUp,
    signUpWithCompany,
    signOut,
    resetPassword,
  }), [user, session, userProfile, loading, companySettings, refreshCompanySettings, signIn, signUp, signUpWithCompany, signOut, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
