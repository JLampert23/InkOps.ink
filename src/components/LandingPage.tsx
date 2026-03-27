import { ArrowRight, CheckCircle, Package, TrendingUp, ShoppingCart, Calendar, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface LandingPageProps {
  onLoginClick: () => void;
}

export function LandingPage({ onLoginClick }: LandingPageProps) {
  const { darkMode, toggleDarkMode } = useTheme();

  const navigateToFeatures = () => {
    window.location.href = '/features';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-slate-700/50 transition-colors">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center">
              <img
                src="/InkOps-01-copy.png"
                alt="InkOps Pro"
                className="h-12 w-auto"
              />
            </div>
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
      <section className="pt-32 pb-20 px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight transition-colors">
              The Operating System for<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                Screen Printing & Embroidery Shops
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 dark:text-slate-300 mb-10 leading-relaxed transition-colors">
              Quotes, mockups, production, inventory — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onLoginClick}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg transition-all duration-200 shadow-xl hover:shadow-blue-500/50 flex items-center justify-center gap-2"
              >
                Log In
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={navigateToFeatures}
                className="px-8 py-4 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-bold text-lg rounded-lg transition-all duration-200 border-2 border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500"
              >
                See Features
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 lg:px-8 bg-gray-50 dark:bg-slate-800/50 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">
              Everything You Need to Run Your Shop
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-400 transition-colors">
              Streamline operations from quote to delivery
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-6">
                <Package className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Quotes & Mockups</h3>
              <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed transition-colors">
                Create professional quotes with dynamic pricing, product selection from multiple vendors, and visual mockup generation. Get customer approval faster with streamlined workflows.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Production Tracking</h3>
              <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed transition-colors">
                Track every job through your workflow with custom production stations, real-time status updates, and automated notifications. Keep your team coordinated and customers informed.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-6">
                <ShoppingCart className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Vendor Pricing & Inventory</h3>
              <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed transition-colors">
                Integrate with major suppliers for real-time pricing, product specs, and inventory levels. Create purchase orders automatically and track receiving with complete visibility.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-6">
                <Calendar className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Work Orders & Scheduling</h3>
              <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed transition-colors">
                Automated work order creation with intelligent scheduling. Manage production timelines, coordinate teams, and hit deadlines with built-in workflow automation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots/Mockups Section */}
      <section className="py-20 px-6 lg:px-8 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">
              Built for Production
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-400 transition-colors">
              A comprehensive platform designed specifically for decorated apparel businesses
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 border border-gray-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Smart Quoting</h3>
              </div>
              <p className="text-gray-600 dark:text-slate-400 transition-colors">
                Dynamic pricing matrices, imprint calculations, and vendor product search all integrated into one seamless quoting experience.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 border border-gray-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Complete Accounting</h3>
              </div>
              <p className="text-gray-600 dark:text-slate-400 transition-colors">
                Invoicing, payments, accounts receivable, and customer billing all managed from a single dashboard with automation.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 border border-gray-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Workflow Automation</h3>
              </div>
              <p className="text-gray-600 dark:text-slate-400 transition-colors">
                From quote approval to invoice generation, automate repetitive tasks and focus on growing your business.
              </p>
            </div>
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
