import {
  ArrowRight, Sun, Moon, Package, TrendingUp, BarChart3, Users,
  ShoppingCart, Zap, Mail, Plus, FileText, Calendar, Palette,
  CreditCard, Truck, CheckCircle, Clock, Boxes, Settings,
  Target, Image, DollarSign, Lock, Globe, Smartphone
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface FeaturesPageProps {
  onLoginClick: () => void;
  onBackToHome: () => void;
}

interface Feature {
  name: string;
  description: string;
}

interface FeatureCategory {
  title: string;
  icon: any;
  color: string;
  features: Feature[];
}

export function FeaturesPage({ onLoginClick, onBackToHome }: FeaturesPageProps) {
  const { darkMode, toggleDarkMode } = useTheme();

  const featureCategories: FeatureCategory[] = [
    {
      title: 'Production Management',
      icon: Package,
      color: 'blue',
      features: [
        { name: 'Quote Builder', description: 'Dynamic pricing and mockup generation' },
        { name: 'Work Orders', description: 'Automated creation and PDF export' },
        { name: 'Production Scheduler', description: 'Kanban and timeline views' },
        { name: 'Imprint Builder', description: 'Screen Print, Embroidery, DTG, Heat Transfer, Sublimation' },
        { name: 'Proof Management', description: 'Customer approval workflows' },
        { name: 'Custom Workflows', description: 'Configure production stations' },
      ],
    },
    {
      title: 'Accounting & Billing',
      icon: DollarSign,
      color: 'green',
      features: [
        { name: 'Invoice Management', description: 'Creation, tracking, and PDF export' },
        { name: 'Stripe Integration', description: 'Automated payment processing' },
        { name: 'Manual Payments', description: 'Cash, Check, ACH recording' },
        { name: 'Accounts Receivable', description: 'Aging reports and tracking' },
        { name: 'Payment History', description: 'Complete transaction records' },
        { name: 'Customer Billing', description: 'Summaries and statements' },
      ],
    },
    {
      title: 'Analytics & Reports',
      icon: BarChart3,
      color: 'orange',
      features: [
        { name: 'Revenue Analytics', description: 'Visual charts and trends' },
        { name: 'Top Products', description: 'Best-selling items and categories' },
        { name: 'Customer Value', description: 'Lifetime value reports' },
        { name: 'Margin Tracking', description: 'Profitability estimation' },
        { name: 'Invoice Reports', description: 'Status and overdue tracking' },
        { name: 'Custom Reports', description: 'Builder with CSV/PDF export' },
      ],
    },
    {
      title: 'Customer Management',
      icon: Users,
      color: 'violet',
      features: [
        { name: 'Customer Profiles', description: 'Complete contact management' },
        { name: 'Customer Portal', description: 'Self-service for invoices, quotes, proofs' },
        { name: 'Artwork Library', description: 'Store customer files' },
        { name: 'Multiple Addresses', description: 'Billing and shipping locations' },
        { name: 'Payment Terms', description: 'Credit limit tracking' },
        { name: 'Order History', description: 'Complete purchase records' },
      ],
    },
    {
      title: 'Purchase Orders & Inventory',
      icon: ShoppingCart,
      color: 'cyan',
      features: [
        { name: 'Auto PO Creation', description: 'Generate from work orders' },
        { name: 'Receiving Dashboard', description: 'Track incoming goods' },
        { name: 'Supplier Integration', description: 'SanMar, SSActivewear' },
        { name: 'Live Pricing', description: 'Real-time vendor pricing' },
        { name: 'Inventory Lookup', description: 'Stock availability' },
        { name: 'Stock Management', description: 'Track inventory levels' },
      ],
    },
    {
      title: 'Integrations',
      icon: Zap,
      color: 'yellow',
      features: [
        { name: 'Stripe', description: 'Payment processing' },
        { name: 'Square', description: 'POS transactions and inventory' },
        { name: 'ShipStation', description: 'Shipping labels and tracking' },
        { name: 'SanMar', description: 'Product catalog and pricing' },
        { name: 'SSActivewear', description: 'Wholesale garment supplier' },
        { name: 'Resend & Twilio', description: 'Email and SMS communication' },
      ],
    },
    {
      title: 'Automation & Workflows',
      icon: Target,
      color: 'red',
      features: [
        { name: 'Automation Builder', description: '10+ trigger types' },
        { name: 'Email Notifications', description: 'Automated customer updates' },
        { name: 'SMS Alerts', description: 'Text message automation' },
        { name: 'Payment Requests', description: 'Automatic billing reminders' },
        { name: 'Status Triggers', description: 'Workflow automation' },
        { name: 'Scheduled Actions', description: 'Time-based automation' },
      ],
    },
    {
      title: 'Communication',
      icon: Mail,
      color: 'teal',
      features: [
        { name: 'Email Templates', description: 'Rich text editor' },
        { name: 'Dynamic Shortcodes', description: 'Personalized messages' },
        { name: 'Smart Blocks', description: 'Reusable content sections' },
        { name: 'Auto-Attach Files', description: 'PDFs, mockups, terms' },
        { name: 'Quote Sending', description: 'Professional quote emails' },
        { name: 'Invoice Delivery', description: 'Automated invoice emails' },
      ],
    },
    {
      title: 'Additional Features',
      icon: Plus,
      color: 'slate',
      features: [
        { name: 'Mockup Generator', description: 'Visual artwork placement' },
        { name: 'Box Label Editor', description: 'Custom shipping labels' },
        { name: 'Role-Based Access', description: 'User permissions (RBAC)' },
        { name: 'Dark Mode', description: 'Theme customization' },
        { name: 'Public Approvals', description: 'Shareable quote links' },
        { name: 'Custom Domains', description: 'Branded customer portals' },
      ],
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50 dark:bg-blue-600/10', border: 'border-blue-200 dark:border-blue-500/30', text: 'text-blue-700 dark:text-blue-400', icon: 'text-blue-600 dark:text-blue-500' },
      green: { bg: 'bg-green-50 dark:bg-green-600/10', border: 'border-green-200 dark:border-green-500/30', text: 'text-green-700 dark:text-green-400', icon: 'text-green-600 dark:text-green-500' },
      orange: { bg: 'bg-orange-50 dark:bg-orange-600/10', border: 'border-orange-200 dark:border-orange-500/30', text: 'text-orange-700 dark:text-orange-400', icon: 'text-orange-600 dark:text-orange-500' },
      violet: { bg: 'bg-violet-50 dark:bg-violet-600/10', border: 'border-violet-200 dark:border-violet-500/30', text: 'text-violet-700 dark:text-violet-400', icon: 'text-violet-600 dark:text-violet-500' },
      cyan: { bg: 'bg-cyan-50 dark:bg-cyan-600/10', border: 'border-cyan-200 dark:border-cyan-500/30', text: 'text-cyan-700 dark:text-cyan-400', icon: 'text-cyan-600 dark:text-cyan-500' },
      yellow: { bg: 'bg-yellow-50 dark:bg-yellow-600/10', border: 'border-yellow-200 dark:border-yellow-500/30', text: 'text-yellow-700 dark:text-yellow-400', icon: 'text-yellow-600 dark:text-yellow-500' },
      red: { bg: 'bg-red-50 dark:bg-red-600/10', border: 'border-red-200 dark:border-red-500/30', text: 'text-red-700 dark:text-red-400', icon: 'text-red-600 dark:text-red-500' },
      teal: { bg: 'bg-teal-50 dark:bg-teal-600/10', border: 'border-teal-200 dark:border-teal-500/30', text: 'text-teal-700 dark:text-teal-400', icon: 'text-teal-600 dark:text-teal-500' },
      slate: { bg: 'bg-slate-50 dark:bg-slate-600/10', border: 'border-slate-200 dark:border-slate-500/30', text: 'text-slate-700 dark:text-slate-400', icon: 'text-slate-600 dark:text-slate-500' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-slate-700/50 transition-colors">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <button
              onClick={onBackToHome}
              className="flex items-center hover:opacity-80 transition-opacity"
            >
              <img
                src="/InkOps-01-copy.png"
                alt="InkOps Pro"
                className="h-12 w-auto"
              />
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className="p-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-200"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={onLoginClick}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight transition-colors">
              Complete Feature Set
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 dark:text-slate-300 mb-10 leading-relaxed transition-colors">
              Everything you need to run a modern screen printing and embroidery business
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 px-6 lg:px-8 bg-gray-50 dark:bg-slate-800/50 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCategories.map((category, idx) => {
              const Icon = category.icon;
              const colors = getColorClasses(category.color);

              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <div className="p-6">
                    <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center mb-4 border ${colors.border}`}>
                      <Icon className={`w-6 h-6 ${colors.icon}`} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">
                      {category.title}
                    </h3>
                    <ul className="space-y-2.5">
                      {category.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <CheckCircle className={`w-4 h-4 ${colors.text} mt-0.5 flex-shrink-0`} />
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {feature.name}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-slate-400"> — {feature.description}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integration Partners */}
      <section className="py-20 px-6 lg:px-8 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">
              Powerful Integrations
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-400 transition-colors">
              Connect with the tools you already use
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[
              { name: 'Stripe', icon: CreditCard, description: 'Payment Processing' },
              { name: 'Square', icon: DollarSign, description: 'POS & Payments' },
              { name: 'ShipStation', icon: Truck, description: 'Shipping & Fulfillment' },
              { name: 'SanMar', icon: Package, description: 'Wholesale Garments' },
              { name: 'SSActivewear', icon: Package, description: 'Apparel Supplier' },
              { name: 'Resend', icon: Mail, description: 'Email Service' },
              { name: 'Twilio', icon: Smartphone, description: 'SMS Messaging' },
              { name: 'Chipply', icon: Image, description: 'Webstore Integration' },
            ].map((integration, idx) => {
              const Icon = integration.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 text-center shadow-md hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-7 h-7 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1">{integration.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-slate-400">{integration.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Shop?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join shops already using INKOPS to streamline their operations
          </p>
          <button
            onClick={onLoginClick}
            className="px-10 py-5 bg-white text-blue-600 hover:bg-slate-100 font-bold text-lg rounded-lg transition-all duration-200 shadow-xl hover:shadow-2xl inline-flex items-center gap-3"
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-8 bg-gray-100 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-gray-600 dark:text-slate-400 transition-colors">
              © {new Date().getFullYear()} INKOPS. All rights reserved.
            </div>
            <div className="flex gap-8">
              <a href="#" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Terms
              </a>
              <a href="#" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Privacy
              </a>
              <a href="mailto:info@inkops.ink" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
