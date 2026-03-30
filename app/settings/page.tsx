'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, User, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

// Profile Schema defined based on requirements
const profileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric only (no spaces or special characters)'),
  email: z.string().email('Please enter a valid email address'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPortal() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialize form with react-hook-form and zodResolver
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchUserProfile(token);
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      if (data.user) {
        reset({
          username: data.user.username || '',
          email: data.user.email || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Could not load profile settings');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific validation/server errors
        const errorMessage = result.error || 'Update failed';
        toast.error(errorMessage);
        return;
      }

      toast.success('Profile updated successfully!');
      
      // Update local storage if necessary
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        localStorage.setItem('user', JSON.stringify({ ...user, ...result.user }));
      }

    } catch (error) {
      console.error('Submission error:', error);
      toast.error('An unexpected error occurred during submission.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Securing portal access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 md:px-6 lg:px-8">
      {/* react-hot-toast Toaster configuration */}
      <Toaster position="top-right" reverseOrder={false} />
      
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Link href="/profile" className="inline-flex items-center text-sm text-primary hover:underline mb-2">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to Profile
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Account Settings</h1>
            <p className="text-muted-foreground font-medium">Manage your personal identity and security preferences.</p>
          </div>
          <div className="hidden sm:block">
             <div className="p-3 bg-primary/10 rounded-full">
                <ShieldCheck className="h-8 w-8 text-primary" />
             </div>
          </div>
        </div>

        <Card className="border-border shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your public username and linked email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                {/* Username Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="username" className="text-sm font-semibold">Username</Label>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Public Identity</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-muted-foreground/50">
                      <User className="h-4 w-4" />
                    </div>
                    <Input
                      id="username"
                      placeholder="ajo_member123"
                      className={`pl-10 transition-all duration-200 focus:ring-2 ${errors.username ? 'border-destructive ring-destructive/20' : 'focus:ring-primary/20'}`}
                      {...register('username')}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Authentication</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-muted-foreground/50">
                      <Mail className="h-4 w-4" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      className={`pl-10 transition-all duration-200 focus:ring-2 ${errors.email ? 'border-destructive ring-destructive/20' : 'focus:ring-primary/20'}`}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <Button 
                  type="submit" 
                  disabled={saving} 
                  className="w-full sm:w-auto min-w-[140px] shadow-sm hover:shadow-md transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </Button>
                <p className="mt-4 text-[11px] text-muted-foreground text-center sm:text-left italic">
                  Changes will be reflected across all your savings circles immediately.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security Alert / Info Card */}
        <Card className="border-amber-200/50 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20 shadow-none border">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Security Note</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-400/70 leading-relaxed">
                  Your username is strictly bound to your account. Alphanumeric restrictions help prevent injection attacks and ensure compatibility with Stellar network metadata.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
