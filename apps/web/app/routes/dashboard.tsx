import { useNavigate, Form } from 'react-router';
import { api } from '../lib/api';
import type { RepositoryResponse, PullRequestEventResponse } from '../types';
import DashboardLayout from '../components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { GitPullRequest, Github, Plus, TrendingUp, ArrowUpRight, Download } from 'lucide-react';
import { EmptyState } from '../components/empty-state';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { RepositoryCard } from '../components/repository-card';
import { PREventCard } from '../components/pr-event-card';
import type { Route } from './+types/dashboard';
import { useAuth } from '@clerk/react-router';
import { useEffect, useState } from 'react';

// Simple loader that returns empty data - we'll fetch on client side
export const loader = async () => {
  return { initialLoad: true };
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'connect-github') {
    api.connectGitHub();
    return null;
  }

  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [repos, setRepos] = useState<RepositoryResponse[]>([]);
  const [events, setEvents] = useState<PullRequestEventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on client side with auth token
  useEffect(() => {
    async function fetchData() {
      if (!isLoaded) return;
      
      if (!isSignedIn) {
        navigate('/');
        return;
      }

      try {
        setIsLoading(true);
        const token = await getToken();
        
        const [reposResponse, eventsResponse] = await Promise.all([
          api.getRepositories(token),
          api.getPullRequestEvents(token),
        ]);

        setRepos(reposResponse.data || []);
        setEvents(eventsResponse.data || []);
      } catch (error) {
        console.error('Dashboard data fetch error:', error);
        setRepos([]);
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [isLoaded, isSignedIn, getToken, navigate]);

  const handleDisconnect = async (installationId: string) => {
    if (!confirm('Are you sure you want to disconnect this repository?')) {
      return;
    }
    
    try {
      const token = await getToken();
      await api.disconnectRepository(installationId, token);
      
      // Refresh the data
      const [reposResponse, eventsResponse] = await Promise.all([
        api.getRepositories(token),
        api.getPullRequestEvents(token),
      ]);
      
      setRepos(reposResponse.data || []);
      setEvents(eventsResponse.data || []);
    } catch (error) {
      console.error('Failed to disconnect repository:', error);
      alert('Failed to disconnect repository. Please try again.');
    }
  };

  const todayEvents = events.filter(e => {
    const today = new Date().toDateString();
    return new Date(e.receivedAt).toDateString() === today;
  }).length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <LoadingSkeleton type="card" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="text-gray-400 mt-2 text-base">
              Plan, prioritize, and accomplish your tasks with ease.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => api.connectGitHub()}
              className="bg-mint-500 hover:bg-mint-600 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
            <Button variant="outline" className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 rounded-xl">
              Import Data
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-mint-500 to-mint-600 text-white border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-mint-100">Total Projects</CardDescription>
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-5xl font-bold mb-2">{repos.length}</CardTitle>
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="h-4 w-4" />
                <span className="text-mint-100">Increased from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#252525] border-white/10 hover:bg-[#2a2a2a] transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-gray-400">Ended Projects</CardDescription>
                <ArrowUpRight className="h-4 w-4 text-mint-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-5xl font-bold mb-2 text-white">{Math.floor(repos.length * 0.4)}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-mint-500">
                <TrendingUp className="h-4 w-4" />
                <span>Increased from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#252525] border-white/10 hover:bg-[#2a2a2a] transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-gray-400">Running Projects</CardDescription>
                <ArrowUpRight className="h-4 w-4 text-mint-500" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-5xl font-bold mb-2 text-white">{Math.max(1, repos.length - Math.floor(repos.length * 0.4))}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-mint-500">
                <TrendingUp className="h-4 w-4" />
                <span>Increased from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#252525] border-white/10 hover:bg-[#2a2a2a] transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-gray-400">Pending Project</CardDescription>
                <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/10">On Discuss</span>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-5xl font-bold text-white">{todayEvents}</CardTitle>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Analytics + Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Project Analytics */}
            <Card className="bg-[#252525] border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-white">Project Analytics</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-8 rounded-lg hover:bg-white/5">
                      D
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-8 rounded-lg hover:bg-white/5">
                      M
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-8 rounded-lg hover:bg-white/5">
                      Y
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs text-white bg-mint-500 h-8 rounded-lg hover:bg-mint-600">
                      All
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-8 rounded-lg hover:bg-white/5">
                      Custom
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Simple Bar Chart Visualization */}
                <div className="flex items-end justify-between h-48 gap-4">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
                    const heights = [40, 65, 50, 85, 70, 55, 45];
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full relative">
                          <div 
                            className="w-full bg-mint-500 rounded-t-lg transition-all hover:bg-mint-600"
                            style={{ height: `${heights[i]}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-gray-400">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-[#252525] border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                      <GitPullRequest className="h-5 w-5 text-mint-500" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription className="text-gray-400">Latest pull request events from your webhooks</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <EmptyState
                    icon={<GitPullRequest className="h-12 w-12" />}
                    title="No pull request events yet"
                    description="Events will appear here when webhooks are triggered from your connected repositories."
                  />
                ) : (
                  <div className="space-y-4">
                    {events.slice(0, 5).map((event) => (
                      <PREventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Repositories + Projects */}
          <div className="space-y-8">
            {/* Repositories */}
            <Card className="bg-[#252525] border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                      <Github className="h-5 w-5 text-white" />
                      Repositories
                    </CardTitle>
                    <CardDescription className="text-gray-400">Connected via GitHub App</CardDescription>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="connect-github" />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 w-9 p-0 bg-mint-500 hover:bg-mint-600 text-white rounded-lg"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Form>
                </div>
              </CardHeader>
              <CardContent>
                {repos.length === 0 ? (
                  <EmptyState
                    icon={<Github className="h-12 w-12" />}
                    title="No repositories connected"
                    description="Connect your GitHub repositories to start receiving pull request updates."
                    action={{
                      label: 'Connect GitHub',
                      onClick: () => api.connectGitHub(),
                    }}
                  />
                ) : (
                  <div className="space-y-4">
                    {repos.map((repo) => (
                      <RepositoryCard
                        key={repo.id}
                        repository={repo}
                        onDisconnect={handleDisconnect}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Project Progress */}
            <Card className="border-white/10 bg-gradient-to-br from-mint-500 to-mint-600 text-white">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Project Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-48 h-48 mx-auto mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      stroke="white"
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray={`${(repos.length > 0 ? 65 : 0) * 5.03} ${100 * 5.03}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold">{repos.length > 0 ? 65 : 0}%</span>
                    <span className="text-sm text-mint-100 mt-1">Project Ended</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    <span className="text-mint-100">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                    <span className="text-mint-100">In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                    <span className="text-mint-100">Pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
