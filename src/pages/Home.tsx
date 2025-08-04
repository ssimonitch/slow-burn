import type { FunctionComponent } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useIsAuthenticated } from '@/stores/auth.store';

export const Home: FunctionComponent = () => {
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-2 text-4xl font-bold">Slow Burn</h1>
        <p className="text-muted-foreground mb-8">Your AI-powered fitness companion</p>

        <div className="space-y-4">
          <Button asChild className="min-h-[44px] w-full" size="lg">
            <Link to="/login">Sign In</Link>
          </Button>

          <Button asChild variant="outline" className="min-h-[44px] w-full" size="lg">
            <Link to="/signup">Create Account</Link>
          </Button>
        </div>

        <p className="text-muted-foreground mt-8 text-sm">
          Build consistency. Track progress. Achieve your fitness goals.
        </p>
      </div>
    </div>
  );
};
