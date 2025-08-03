import { Dumbbell, Flame, TrendingUp } from 'lucide-react';
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * AuthLayout provides a consistent wrapper for authentication pages
 * with branding, motivational messaging, and responsive design
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding and messaging (hidden on mobile) */}
      <div className="bg-muted relative hidden flex-1 flex-col justify-between p-8 lg:flex">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 35px,
                currentColor 35px,
                currentColor 70px
              )`,
            }}
          />
        </div>

        {/* Top - Logo and brand name */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-lg">
            <Flame className="h-7 w-7" />
          </div>
          <span className="text-2xl font-bold">Slow Burn</span>
        </div>

        {/* Middle - Motivational content */}
        <div className="relative z-10 max-w-lg">
          <h1 className="mb-6 text-4xl leading-tight font-bold">
            Build strength.
            <br />
            Forge discipline.
            <br />
            <span className="text-primary">Ignite your potential.</span>
          </h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Your AI fitness companion adapts to your journey, growing stronger alongside you with every workout.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            <FeatureItem
              icon={<Dumbbell className="h-5 w-5" />}
              title="Personalized Training"
              description="Workout plans that evolve with your progress"
            />
            <FeatureItem
              icon={<TrendingUp className="h-5 w-5" />}
              title="Track Progress"
              description="Comprehensive logging and analytics"
            />
            <FeatureItem
              icon={<Flame className="h-5 w-5" />}
              title="AI Companion"
              description="Build a relationship that motivates you"
            />
          </div>
        </div>

        {/* Bottom - Footer text */}
        <div className="text-muted-foreground relative z-10 text-sm">
          &copy; {new Date().getFullYear()} Slow Burn. Train with purpose.
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex flex-1 flex-col justify-center">
        {/* Mobile header - only visible on small screens */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="bg-primary text-primary-foreground mb-4 flex h-16 w-16 items-center justify-center rounded-xl">
            <Flame className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-bold">Slow Burn</h2>
          <p className="text-muted-foreground mt-2 text-center text-sm">Your AI Fitness Companion</p>
        </div>

        {/* Auth form container */}
        <div className="mx-auto w-full px-6 sm:px-8 md:px-12 lg:px-8">
          <div className="mx-auto w-full max-w-sm lg:max-w-md">{children}</div>
        </div>

        {/* Mobile footer - only visible on small screens */}
        <div className="text-muted-foreground mt-8 text-center text-xs lg:hidden">
          &copy; {new Date().getFullYear()} Slow Burn
        </div>
      </div>
    </div>
  );
};

/**
 * Feature item component for the left side panel
 */
interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => {
  return (
    <div className="flex gap-3">
      <div className="text-primary mt-0.5 shrink-0">{icon}</div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
};
