import React, { useState } from 'react';
import { Lock, CheckCircle, Loader2, ArrowRight, Shield, Zap, Sparkles } from 'lucide-react';
import { stripeService } from '../../services/stripe-service';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';

export function HardPaywall() {
  const { userProfile } = useAuth(); 
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (tier: string) => {
    try {
      if (!userProfile?.company_id) {
        console.error("Missing company ID inside user profile. Ensure user is fully loaded.");
        alert("Missing company ID. Please wait or reload.");
        return;
      }
      setIsLoading(tier);
      const checkoutUrl = await stripeService.createSubscriptionCheckout(tier, userProfile.company_id);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error(error);
      alert('Failed to start checkout: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-600/10 dark:from-blue-900/20 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl mb-6">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">
            Choose Your Subscription Plan
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Your account requires an active subscription to access the InkOps platform. 
            Pick the plan that fits your shop's operations below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* Starter Tier */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200 dark:border-slate-700 relative flex flex-col hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Starter Tier
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Perfect for growing print shops looking to organize their workflow.</p>
            </div>
            
            <div className="mb-8 border-b border-slate-100 dark:border-slate-700 pb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white">$199</span>
                <span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-10 flex-grow">
              {[
                'Unlimited Users',
                'Core Quoting & Invoicing',
                'Basic Production Tracking',
                'Standard Email Support'
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              disabled={isLoading !== null}
              onClick={() => handleSubscribe('starter')}
              className="w-full relative group inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-70"
            >
              {isLoading === 'starter' ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <>Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>

          {/* Professional Tier */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl border-2 border-indigo-500 relative flex flex-col transform md:-translate-y-4">
            <div className="absolute top-0 right-0 -mt-4 mr-6">
              <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                <Sparkles className="w-3.5 h-3.5" /> Most Popular
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Professional Tier
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Complete automation and advanced features for high-volume shops.</p>
            </div>
            
            <div className="mb-8 border-b border-slate-100 dark:border-slate-700 pb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white">$299</span>
                <span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-10 flex-grow">
              {[
                'Everything in Starter',
                'Advanced Production Scheduling',
                'Full API & Integrations Access',
                'Automated Purchase Orders',
                'Priority 24/7 Support'
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-indigo-500 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              disabled={isLoading !== null}
              onClick={() => handleSubscribe('professional')}
              className="w-full relative group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-70"
            >
              {isLoading === 'professional' ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <>Unlock Professional <Zap className="w-5 h-5" /></>
              )}
            </button>
          </div>

        </div>

        <div className="mt-12 text-center flex flex-col items-center gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 justify-center">
            <Shield className="w-4 h-4" /> Secure payments powered by Stripe
          </p>
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium transition-colors"
          >
            Log out to switch accounts
          </button>
        </div>
      </div>
    </div>
  );
}
