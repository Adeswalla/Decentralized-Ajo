/**
 * Merchant Registration Form Component
 * Closes #619
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building2, Upload, CheckCircle2 } from 'lucide-react';

const merchantSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessDescription: z.string().min(10, 'Description must be at least 10 characters'),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  contactEmail: z.string().email('Must be a valid email'),
  contactPhone: z.string().min(10, 'Phone number must be at least 10 digits'),
  businessLogo: z.any().optional(),
});

type MerchantFormData = z.infer<typeof merchantSchema>;

interface MerchantRegistrationFormProps {
  onComplete?: () => void;
}

export function MerchantRegistrationForm({ onComplete }: MerchantRegistrationFormProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MerchantFormData>({
    resolver: zodResolver(merchantSchema),
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: MerchantFormData) => {
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success('Merchant registration submitted successfully!');
      onComplete?.();
    } catch (error) {
      toast.error('Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Business Profile Setup</CardTitle>
        </div>
        <CardDescription>
          Tell us about your business to get started with merchant features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Business Logo */}
          <div className="space-y-2">
            <Label htmlFor="businessLogo">Business Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative w-24 h-24 rounded-lg border overflow-hidden">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border border-dashed flex items-center justify-center bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  id="businessLogo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG or SVG (max 2MB)
                </p>
              </div>
            </div>
          </div>

          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="businessName">
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="businessName"
              {...register('businessName')}
              placeholder="Enter your business name"
            />
            {errors.businessName && (
              <p className="text-sm text-destructive">{errors.businessName.message}</p>
            )}
          </div>

          {/* Business Description */}
          <div className="space-y-2">
            <Label htmlFor="businessDescription">
              Business Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="businessDescription"
              {...register('businessDescription')}
              placeholder="Describe your business and what you offer"
              rows={4}
            />
            {errors.businessDescription && (
              <p className="text-sm text-destructive">{errors.businessDescription.message}</p>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              {...register('website')}
              placeholder="https://example.com"
              type="url"
            />
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">
              Contact Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactEmail"
              {...register('contactEmail')}
              placeholder="contact@business.com"
              type="email"
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
            )}
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="contactPhone">
              Contact Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactPhone"
              {...register('contactPhone')}
              placeholder="+1 (555) 123-4567"
              type="tel"
            />
            {errors.contactPhone && (
              <p className="text-sm text-destructive">{errors.contactPhone.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Registration
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
