import { Link } from 'react-router';
import { useClerk, UserButton } from "@clerk/react-router";
import { Button } from '../ui/button';
import { LayoutDashboard, Settings, HelpCircle, LogOut, GitBranch, Search, Bell, Menu } from 'lucide-react';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#202020] border-r border-white/10 hidden lg:flex flex-col">
        {/* Logo */}
        <div className="p-6 pb-8">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-mint-500 to-mint-600 flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white group-hover:text-mint-400 transition-colors">
              Commit Lens
            </span>
          </Link>
        </div>
        
        {/* Menu Section */}
        <div className="px-3 mb-2">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Menu
          </p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-mint-500 rounded-xl hover:bg-mint-600 transition-all"
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Link>
          
          {/* Add more menu items in future */}
        </nav>

        {/* General Section */}
        <div className="px-3 mt-6 mb-2">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            General
          </p>
        </div>
        
        <nav className="px-3 space-y-1 mb-6">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 rounded-xl hover:bg-white/5 transition-colors">
            <Settings className="h-5 w-5" />
            Settings
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 rounded-xl hover:bg-white/5 transition-colors">
            <HelpCircle className="h-5 w-5" />
            Help
          </button>
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 rounded-xl hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <UserButton />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Header */}
        <header className="h-20 border-b border-white/10 bg-[#1e1e1e] flex items-center px-6 lg:px-8">
          <div className="flex items-center justify-between w-full">
            {/* Mobile Menu + Search */}
            <div className="flex items-center gap-4 flex-1">
              <button className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors">
                <Menu className="h-5 w-5 text-gray-400" />
              </button>
              
              {/* Search Bar */}
              <div className="hidden md:flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 max-w-md w-full border border-white/10">
                <Search className="h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search task" 
                  className="bg-transparent border-none outline-none text-sm text-gray-300 placeholder-gray-500 w-full"
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-gray-500 bg-white/5 rounded border border-white/10">
                  ⌘F
                </kbd>
              </div>
            </div>
            
            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
                <Bell className="h-5 w-5 text-gray-400" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-mint-500 rounded-full"></span>
              </button>
              
              <div className="lg:hidden">
                <UserButton />
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
