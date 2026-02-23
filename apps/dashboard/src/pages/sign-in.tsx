import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Vortex } from '@/components/ui/vortex';
import { Bird, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function SignInPage() {
  const [isPending, setIsPending] = useState(false);

  async function handleSignIn() {
    setIsPending(true);
    try {
      const { error } = await signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      });
      if (error) {
        toast.error('Sign in failed. Please try again.');
      }
    } catch {
      toast.error('Sign in failed. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="dark">
      <Vortex
        containerClassName="min-h-screen"
        className="flex min-h-screen items-center justify-center p-4 pb-[20vh]"
      >
        <Card className="w-full max-w-sm border-white/10 bg-white/5 px-2 py-4 shadow-2xl backdrop-blur-sm">
          <CardHeader className="flex items-center justify-center pb-6">
            <Bird className="size-6 text-primary" />
            <span className="text-2xl font-semibold tracking-tight text-white">
              Lyrebird
            </span>
          </CardHeader>

          <CardContent className="space-y-5">
            <Button
              variant="outline"
              size="lg"
              className="w-full cursor-pointer gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={handleSignIn}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </Button>

            <p className="text-center text-xs text-zinc-500">
              By continuing, you agree to our{' '}
              <a
                href="/terms"
                className="underline underline-offset-4 transition-colors hover:text-zinc-300"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                className="underline underline-offset-4 transition-colors hover:text-zinc-300"
              >
                Privacy Policy
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </Vortex>
    </div>
  );
}
