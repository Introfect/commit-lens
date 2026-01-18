import { Button } from '../components/ui/button';
import { GitBranch, ArrowRight, Play, ChevronDown } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/react-router";
import { Link } from 'react-router';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-mint-900 text-white font-sans selection:bg-mint-500/20 relative overflow-hidden">
      {/* Animated Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-mint-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-mint-400 to-mint-600 flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">Commit Lens</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="hidden md:inline text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Home
            </a>
            <a href="#features" className="hidden md:inline text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Features
            </a>
            <a href="#assets" className="hidden md:inline text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Assets
            </a>
            <a href="#pricing" className="hidden md:inline text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hidden md:inline text-sm font-medium text-gray-300 hover:text-white transition-colors">
              FAQ
            </a>
            
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10">
                    Sign in
                  </Button>
                </SignInButton>
                <SignInButton mode="modal">
                  <Button className="bg-mint-500 hover:bg-mint-600 text-white">
                    Create Account
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Button asChild className="bg-mint-500 hover:bg-mint-600 text-white">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <UserButton />
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Connection Nodes */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
        {/* Connection Nodes - Top Left */}
        <div className="absolute top-32 left-16 hidden xl:flex flex-col items-start gap-2 animate-float">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Cortex</p>
              <p className="text-xs text-gray-400">20,945</p>
            </div>
          </div>
          <svg className="w-48 h-24" viewBox="0 0 192 96">
            <path d="M 0 0 Q 96 48 192 96" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Connection Nodes - Top Right */}
        <div className="absolute top-40 right-16 hidden xl:flex flex-col items-end gap-2 animate-float" style={{ animationDelay: '0.5s' }}>
          <svg className="w-48 h-24" viewBox="0 0 192 96">
            <path d="M 0 96 Q 96 48 192 0" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          </svg>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium text-white text-right">Quant</p>
              <p className="text-xs text-gray-400 text-right">2,945</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-mint-400"></div>
            </div>
          </div>
        </div>

        {/* Connection Nodes - Bottom Left */}
        <div className="absolute bottom-40 left-24 hidden xl:flex flex-col items-start gap-2 animate-float" style={{ animationDelay: '1s' }}>
          <svg className="w-32 h-32" viewBox="0 0 128 128">
            <path d="M 0 128 Q 64 64 128 0" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          </svg>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Aelf</p>
              <p className="text-xs text-gray-400">19,346</p>
            </div>
          </div>
        </div>

        {/* Connection Nodes - Bottom Right */}
        <div className="absolute bottom-48 right-32 hidden xl:flex flex-col items-end gap-2 animate-float" style={{ animationDelay: '0.7s' }}>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium text-white text-right">Meeton</p>
              <p className="text-xs text-gray-400 text-right">440</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
          </div>
          <svg className="w-32 h-32" viewBox="0 0 128 128">
            <path d="M 128 128 Q 64 64 0 0" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Video Play Button - Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all pointer-events-auto group">
            <Play className="h-8 w-8 text-white ml-1 group-hover:scale-110 transition-transform" fill="white" />
          </button>
        </div>

        {/* Main Hero Content */}
        <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm">
            <GitBranch className="h-4 w-4 text-mint-400" />
            <span className="text-white">Unlock Your Assets Spark!</span>
            <ArrowRight className="h-4 w-4 text-white" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
              <span className="text-white">One-click for </span>
              <span className="bg-gradient-to-r from-white via-mint-200 to-transparent bg-clip-text text-transparent">
                Asset Defense
              </span>
            </h1>
          </div>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Dive into the art assets, where innovative blockchain technology meets financial expertise
          </p>
          
          <div className="flex items-center justify-center gap-4 pt-8">
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="h-14 px-10 text-base bg-mint-500 hover:bg-mint-600 text-white rounded-xl">
                  Open App
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild className="h-14 px-10 text-base bg-mint-500 hover:bg-mint-600 text-white rounded-xl">
                <Link to="/dashboard">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </SignedIn>
            <Button size="lg" variant="outline" className="h-14 px-10 text-base bg-white hover:bg-gray-100 text-gray-900 rounded-xl border-none">
              Discover More
            </Button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-8 flex items-center gap-2 text-sm text-gray-400 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <ChevronDown className="h-4 w-4" />
          </div>
          <span>02/03 · Scroll down</span>
        </div>
      </section>

      {/* Partner Logos Section */}
      <section className="relative py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-8 flex-wrap opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Vercel */}
            <div className="text-white font-bold text-xl tracking-tight">▲ Vercel</div>
            
            {/* Loom */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500"></div>
              <span className="text-white font-semibold text-xl">loom</span>
            </div>
            
            {/* Cash App */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-mint-500 rounded"></div>
              <span className="text-white font-semibold text-xl">Cash App</span>
            </div>
            
            {/* Loops */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white"></div>
                <div className="w-2 h-2 rounded-full bg-white"></div>
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
              <span className="text-white font-semibold text-xl">Loops</span>
            </div>
            
            {/* Zapier */}
            <div className="text-white font-bold text-xl">zapier</div>
            
            {/* Ramp */}
            <div className="text-white font-bold text-xl">ramp ↗</div>
            
            {/* Raycast */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded"></div>
              <span className="text-white font-semibold text-xl">Raycast</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Section */}
      <section className="relative py-16 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-400">
            DeFi horizons
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-1 bg-white rounded-full"></div>
            <div className="w-12 h-1 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2026 Commit Lens. Built with React Router v7 and Hono.</p>
        </div>
      </footer>
    </div>
  );
}
