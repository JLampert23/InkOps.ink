import React, { useState } from 'react';
import { Lock, Zap, ArrowRight, Shield, Star, CheckCircle } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface UpgradeWallProps {
  title: string;
  description: string;
  icon?: React.ElementType;
}

export function UpgradeWall({ title, description, icon: Icon = Lock }: UpgradeWallProps) {
  const { tier } = useSubscription();
  const [isHovered, setIsHovered] = useState(false);

  // If they are somehow already pro, we shouldn't show this, but just in case
  if (tier === 'professional') return null;

  return (
    <div className="relative min-h-[500px] w-full flex items-center justify-center p-6 bg-gray-50/50 dark:bg-slate-900/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Main Card */}
      <div className="relative max-w-2xl w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 p-8 md:p-12 rounded-3xl shadow-2xl transition-all duration-500 hover:shadow-blue-500/10">
        
        {/* Top Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 border border-blue-100/50 dark:border-blue-800/50">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-bold bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent uppercase tracking-wider">
              Professional Tier
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-6 mb-10">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 transform transition-transform duration-500 hover:scale-110">
            <Icon className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Unlock <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">{title}</span>
          </h2>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
            {description} Upgrade to InkOps Professional to automate your workflow and scale your shop.
          </p>
        </div>

        {/* Feature List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 bg-gray-50/50 dark:bg-slate-900/50 p-6 rounded-2xl">
          {[
            'Advanced Production Scheduling',
            'Full API & Integrations Access',
            'Automated Purchase Orders',
            'Up to 25 Team Members'
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{feature}</span>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="flex flex-col items-center gap-4">
          <button
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
              // TODO: Integrate Stripe Checkout Redirect here
              alert('Redirecting to Stripe Checkout...');
            }}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg transition-all duration-300 shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] hover:-translate-y-1 w-full sm:w-auto"
          >
            Upgrade Now - 14 Days Free
            <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Secure payment via Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
