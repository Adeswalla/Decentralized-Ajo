'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateCirclePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    contributionFrequencyDays: '7',
    maxRounds: '12',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = 'Circle name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Circle name must be at least 3 characters';
    }

    if (!formData.contributionAmount) {
      newErrors.contributionAmount = 'Contribution amount is required';
    } else if (parseFloat(formData.contributionAmount) <= 0) {
      newErrors.contributionAmount = 'Contribution amount must be greater than 0';
    }

    const frequency = parseInt(formData.contributionFrequencyDays);
    if (frequency <= 0) {
      newErrors.contributionFrequencyDays = 'Frequency must be greater than 0';
    }

    const rounds = parseInt(formData.maxRounds);
    if (rounds <= 0) {
      newErrors.maxRounds = 'Number of rounds must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in to create a circle');
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/circles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          contributionAmount: parseFloat(formData.contributionAmount),
          contributionFrequencyDays: parseInt(formData.contributionFrequencyDays),
          maxRounds: parseInt(formData.maxRounds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create circle');
        return;
      }

      toast.success('Circle created successfully!');
      router.push(`/circles/${data.circle.id}`);
    } catch (error) {
      console.error('Create circle error:', error);
      toast.error('An error occurred while creating the circle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Create a New Circle</h1>
          <p className="text-muted-foreground mt-2">Start a savings circle with your community</p>
        </div>
      </header>

      {/* Form */}
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Circle Details</CardTitle>
            <CardDescription>
              Set up the basic information for your savings circle. You can adjust settings later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Circle Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Circle Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Office Savings Circle"
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Tell members about your circle..."
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                />
              </div>

              {/* Grid for Contribution Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contribution Amount */}
                <div className="space-y-2">
                  <Label htmlFor="contributionAmount">
                    Contribution Amount (XLM) *
                  </Label>
                  <Input
                    id="contributionAmount"
                    name="contributionAmount"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 100"
                    value={formData.contributionAmount}
                    onChange={handleChange}
                    className={errors.contributionAmount ? 'border-destructive' : ''}
                  />
                  {errors.contributionAmount && (
                    <p className="text-sm text-destructive">{errors.contributionAmount}</p>
                  )}
                </div>

                {/* Frequency */}
                <div className="space-y-2">
                  <Label htmlFor="contributionFrequencyDays">
                    Contribution Frequency (Days) *
                  </Label>
                  <Input
                    id="contributionFrequencyDays"
                    name="contributionFrequencyDays"
                    type="number"
                    placeholder="e.g., 7"
                    value={formData.contributionFrequencyDays}
                    onChange={handleChange}
                    className={errors.contributionFrequencyDays ? 'border-destructive' : ''}
                  />
                  {errors.contributionFrequencyDays && (
                    <p className="text-sm text-destructive">
                      {errors.contributionFrequencyDays}
                    </p>
                  )}
                </div>
              </div>

              {/* Max Rounds */}
              <div className="space-y-2">
                <Label htmlFor="maxRounds">Number of Rounds *</Label>
                <Input
                  id="maxRounds"
                  name="maxRounds"
                  type="number"
                  placeholder="e.g., 12"
                  value={formData.maxRounds}
                  onChange={handleChange}
                  className={errors.maxRounds ? 'border-destructive' : ''}
                />
                {errors.maxRounds && <p className="text-sm text-destructive">{errors.maxRounds}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Each round, one member receives the total pooled amount
                </p>
              </div>

              {/* Summary */}
              <div className="bg-secondary/10 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Circle Summary</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Per Member Contribution:</span>{' '}
                    <span className="font-semibold">
                      {formData.contributionAmount ? `${formData.contributionAmount} XLM` : '-'}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Payout Per Round:</span>{' '}
                    <span className="font-semibold">
                      {formData.contributionAmount && formData.maxRounds
                        ? `${(parseFloat(formData.contributionAmount) * parseInt(formData.maxRounds)).toFixed(2)} XLM`
                        : '-'}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Frequency:</span>{' '}
                    <span className="font-semibold">
                      Every {formData.contributionFrequencyDays} days
                    </span>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Circle'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
