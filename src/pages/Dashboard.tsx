import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore, useUser } from '@/stores/auth.store';

/**
 * Dashboard page - main landing page after login
 *
 * This is a placeholder for the dashboard that will eventually display:
 * - User's workout progress
 * - Recent activities
 * - AI companion messages
 * - Quick access to workout plans
 */
export function Dashboard() {
  // Use dedicated selector hook for user and direct access for actions
  const user = useUser();
  const signOut = useAuthStore((state) => state.signOut);

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.email}</p>
        </div>
        <Button variant="outline" onClick={() => void handleSignOut()} className="min-h-[44px] min-w-[44px]">
          Sign Out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Workout Plans</CardTitle>
            <CardDescription>Your personalized training programs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Create and manage your workout plans to structure your training journey.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="min-h-[44px] w-full sm:w-auto">
                <Link to="/plans">View Plans</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto">
                <Link to="/plans">Create Plan</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Workouts</CardTitle>
            <CardDescription>Your training history</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Start logging workouts to see your progress here.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Companion</CardTitle>
            <CardDescription>Your fitness journey partner</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Your AI companion will be available soon!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
