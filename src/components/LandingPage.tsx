import { ArrowRight, CheckCircle, Package, TrendingUp, ShoppingCart, Calendar } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
}

export function LandingPage({ onLoginClick }: LandingPageProps) {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center">
              <img
                src="/headerlogo.png"
                alt="INKOPS"
                className="h-10 w-auto"
              />
            </div>
            <button
              onClick={onLoginClick}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-orange-500/50"
            >
              Log In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              The Operating System for<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                Screen Printing & Embroidery Shops
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-10 leading-relaxed">
              Quotes, mockups, production, inventory — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onLoginClick}
                className="px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg rounded-lg transition-all duration-200 shadow-xl hover:shadow-orange-500/50 flex items-center justify-center gap-2"
              >
                Log In
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={scrollToFeatures}
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg rounded-lg transition-all duration-200 border-2 border-slate-600 hover:border-slate-500"
              >
                See Features
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Run Your Shop
            </h2>
            <p className="text-xl text-slate-400">
              Streamline operations from quote to delivery
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-orange-600/10 rounded-xl flex items-center justify-center mb-6">
                <Package className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Quotes & Mockups</h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                Create professional quotes with dynamic pricing, product selection from multiple vendors, and visual mockup generation. Get customer approval faster with streamlined workflows.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-orange-600/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Production Tracking</h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                Track every job through your workflow with custom production stations, real-time status updates, and automated notifications. Keep your team coordinated and customers informed.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-orange-600/10 rounded-xl flex items-center justify-center mb-6">
                <ShoppingCart className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Vendor Pricing & Inventory</h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                Integrate with major suppliers for real-time pricing, product specs, and inventory levels. Create purchase orders automatically and track receiving with complete visibility.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all duration-300 shadow-xl">
              <div className="w-14 h-14 bg-orange-600/10 rounded-xl flex items-center justify-center mb-6">
                <Calendar className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Work Orders & Scheduling</h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                Automated work order creation with intelligent scheduling. Manage production timelines, coordinate teams, and hit deadlines with built-in workflow automation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots/Mockups Section */}
      <section className="py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Built for Production
            </h2>
            <p className="text-xl text-slate-400">
              A comprehensive platform designed specifically for decorated apparel businesses
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-orange-500" />
                <h3 className="text-xl font-bold text-white">Smart Quoting</h3>
              </div>
              <p className="text-slate-400">
                Dynamic pricing matrices, imprint calculations, and vendor product search all integrated into one seamless quoting experience.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-orange-500" />
                <h3 className="text-xl font-bold text-white">Complete Accounting</h3>
              </div>
              <p className="text-slate-400">
                Invoicing, payments, accounts receivable, and customer billing all managed from a single dashboard with automation.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-orange-500" />
                <h3 className="text-xl font-bold text-white">Workflow Automation</h3>
              </div>
              <p className="text-slate-400">
                From quote approval to invoice generation, automate repetitive tasks and focus on growing your business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 lg:px-8 bg-gradient-to-r from-orange-600 to-orange-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Shop?
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Join shops already using INKOPS to streamline their operations
          </p>
          <button
            onClick={onLoginClick}
            className="px-10 py-5 bg-white text-orange-600 hover:bg-slate-100 font-bold text-lg rounded-lg transition-all duration-200 shadow-xl hover:shadow-2xl inline-flex items-center gap-3"
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-8 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-slate-400">
              © {new Date().getFullYear()} INKOPS. All rights reserved.
            </div>
            <div className="flex gap-8">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                Terms
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                Privacy
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
