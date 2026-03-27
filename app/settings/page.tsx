'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import { Loader2, Save, User as UserIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { authenticatedFetch } from '@/lib/auth-client';

// Schema aligned with project's UpdateProfileSchema in lib/validations/user.ts
const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters').max(50),
  bio: z.string().trim().max(160, 'Bio must be less than 160 characters').optional().or(z.literal('')),
  phoneNumber: z.string().trim().max(20, 'Phone number must be less than 20 characters').optional().or(z.literal('')),
});

type FormData = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      bio: '',
      phoneNumber: '',
    },
  });

  // Fetch initial profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authenticatedFetch('/api/users/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            const { firstName, lastName, bio, phoneNumber, email } = data.user;
            setUserEmail(email);
            reset({
              firstName: firstName || '',
              lastName: lastName || '',
              bio: bio || '',
              phoneNumber: phoneNumber || '',
            });
          }
        } else {
          toast.error('Failed to load profile settings');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        toast.error('An error occurred while loading settings');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [reset]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          toast.success('Profile updated successfully!');
          // Update local storage user data if needed
          const localUser = localStorage.getItem('user');
          if (localUser) {
            const user = JSON.parse(localUser);
            localStorage.setItem('user', JSON.stringify({ ...user, ...data }));
          }
        } else {
          toast.error(result.error || 'Update failed');
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || 'Update failed - Bad Request');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-10">
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 mb-6 text-2xl font-bold tracking-tight">
        <UserIcon className="h-6 w-6" />
        <h1>Profile Settings</h1>
      </div>

      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your profile details below. This information will be visible to other members in your circles.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  placeholder="John"
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  placeholder="Doe"
                  className={errors.lastName ? 'border-red-500' : ''}
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={userEmail}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-muted-foreground text-[10px]">
                Email address cannot be changed. Contact support if you need to update it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                {...register('phoneNumber')}
                placeholder="+1 (555) 000-0000"
                className={errors.phoneNumber ? 'border-red-500' : ''}
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                {...register('bio')}
                placeholder="Tell us a bit about yourself..."
                className={`resize-none min-h-[100px] ${errors.bio ? 'border-red-500' : ''}`}
              />
              {errors.bio && <p className="text-red-500 text-xs mt-1">{errors.bio.message}</p>}
              <p className="text-muted-foreground text-xs text-right">
                Max 160 characters
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6">
            <Button
              type="submit"
              disabled={saving || !isDirty}
              className="w-full md:w-auto min-w-[120px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
