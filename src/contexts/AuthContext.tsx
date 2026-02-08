import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('Auth initialization timeout - forcing ready state');
      setLoading(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  const refreshUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, role, company_id')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  };

  const refreshCompanySettings = async () => {
    const settings = await getCompanySettings();
    setCompanySettings(settings);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await refreshUserProfile(session.user.id);
          await refreshCompanySettings();
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        try {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            await refreshUserProfile(session.user.id);
            await refreshCompanySettings();
          } else {
            setUserProfile(null);
            setCompanySettings(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signUpWithCompany = async (data: CompanySignupData) => {
    const result = await signUpCompany(data);
    if (!result.error) {
      await refreshCompanySettings();
    }
    return result;
  };

  const signOut = async () => {
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
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
