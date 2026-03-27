'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { authenticatedFetch, clearAuthState } from '@/lib/auth-client';

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
  bio: z.string().max(160, 'Bio must be 160 characters or less').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData: ProfileFormValues;
  onSuccess?: (updated: ProfileFormValues) => void;
}

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialData,
  });

  const bioValue = watch('bio') ?? '';

  const onSubmit = async (data: ProfileFormValues) => {
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (res.status === 401) {
        clearAuthState();
        window.location.href = '/auth/login';
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? 'Failed to update profile');
        return;
      }

      // Keep localStorage in sync
      const stored = localStorage.getItem('user');
      if (stored) {
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(stored), ...json.user }));
      }

      toast.success('Profile updated');
      onSuccess?.(json.user);
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            placeholder="John"
            {...register('firstName')}
            className={errors.firstName ? 'border-destructive' : ''}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            {...register('lastName')}
            className={errors.lastName ? 'border-destructive' : ''}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder="+1 555 000 0000"
          {...register('phoneNumber')}
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="bio">Bio <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <span className={`text-xs ${bioValue.length > 140 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {bioValue.length}/160
          </span>
        </div>
        <Textarea
          id="bio"
          placeholder="Tell your circle members a bit about yourself..."
          rows={3}
          {...register('bio')}
          className={errors.bio ? 'border-destructive' : ''}
        />
        {errors.bio && (
          <p className="text-sm text-destructive">{errors.bio.message}</p>
        )}
      </div>

      <Button type="submit" disabled={saving || !isDirty} className="w-full">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </Button>
    </form>
  );
}
