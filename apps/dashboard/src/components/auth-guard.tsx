import { Loader2 } from 'lucide-react';

import { useSession } from '@/lib/auth-client';
import { SignInPage } from '@/pages/sign-in';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <SignInPage />;

  return <>{children}</>;
}
