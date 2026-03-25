'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileForm } from '@/components/profile-form';
import { authenticatedFetch } from '@/lib/auth-client';

interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  phoneNumber?: string;
  profilePicture?: string;
  walletAddress?: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await authenticatedFetch('/api/users/profile');

      if (!res.ok) {
        router.push('/auth/login');
        return;
      }

      const data = await res.json();
      setProfile(data.user);
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updated: Partial<UserProfile>) => {
    setProfile((prev: UserProfile | null) => prev ? { ...prev, ...updated } : prev);
  };

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email
    : '';

  const initials = profile
    ? [profile.firstName?.[0], profile.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
      profile.email[0].toUpperCase()
    : '';

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal information</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl space-y-6">
        {/* Avatar + identity */}
        <Card>
          <CardContent className="pt-6 flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {profile.profilePicture ? (
                <img
                  src={profile.profilePicture}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary">
                  {initials || <User className="h-7 w-7 text-primary" />}
                </span>
              )}
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              {profile.walletAddress && (
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-xs">
                  {profile.walletAddress}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your name, bio, and contact details</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initialData={{
                firstName: profile.firstName ?? '',
                lastName: profile.lastName ?? '',
                phoneNumber: profile.phoneNumber ?? '',
                bio: profile.bio ?? '',
              }}
              onSuccess={handleProfileUpdate}
            />
          </CardContent>
        </Card>

        {/* Read-only info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{profile.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            {profile.walletAddress && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Wallet</span>
                <span className="font-mono text-xs truncate">{profile.walletAddress}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
