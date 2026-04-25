/**
 * Merchant Registration Flow Component
 * Closes #619
 * 
 * Multi-step registration flow for merchants including:
 * 1. Business profile setup
 * 2. Wallet verification
 * 3. First campaign tutorial
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Wallet, Rocket, Building2 } from 'lucide-react';
import { MerchantRegistrationForm } from './merchant-registration-form';
import { WalletVerificationStep } from './wallet-verification-step';
import { FirstCampaignTutorial } from './first-campaign-tutorial';
import { cn } from '@/lib/utils';

type Step = 'profile' | 'wallet' | 'tutorial' | 'complete';

const steps = [
  { id: 'profile', label: 'Business Profile', icon: Building2 },
  { id: 'wallet', label: 'Wallet Verification', icon: Wallet },
  { id: 'tutorial', label: 'First Campaign', icon: Rocket },
];

export function MerchantRegistrationFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('profile');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const handleStepComplete = (step: Step) => {
    setCompletedSteps((prev) => new Set([...prev, step]));

    // Move to next step
    if (step === 'profile') {
      setCurrentStep('wallet');
    } else if (step === 'wallet') {
      setCurrentStep('tutorial');
    } else if (step === 'tutorial') {
      setCurrentStep('complete');
    }
  };

  const getCurrentStepIndex = () => {
    return steps.findIndex((s) => s.id === currentStep);
  };

  const progress = ((completedSteps.size) / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <CardTitle>Merchant Registration</CardTitle>
          <CardDescription>
            Complete these steps to start creating campaigns (estimated time: 10 minutes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.has(step.id);
              const isCurrent = currentStep === step.id;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors',
                        isCompleted
                          ? 'bg-primary border-primary text-primary-foreground'
                          : isCurrent
                          ? 'border-primary text-primary'
                          : 'border-muted text-muted-foreground'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs mt-2 text-center',
                        isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 mx-2',
                        completedSteps.has(step.id) ? 'bg-primary' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 'profile' && (
          <MerchantRegistrationForm onComplete={() => handleStepComplete('profile')} />
        )}

        {currentStep === 'wallet' && (
          <WalletVerificationStep onComplete={() => handleStepComplete('wallet')} />
        )}

        {currentStep === 'tutorial' && (
          <FirstCampaignTutorial onComplete={() => handleStepComplete('tutorial')} />
        )}

        {currentStep === 'complete' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">Registration Complete!</h2>
              <p className="text-muted-foreground text-center max-w-md">
                You're all set! You can now create and manage campaigns on Stellar Ajo.
              </p>
              <Button size="lg" onClick={() => (window.location.href = '/merchant/dashboard')}>
                Go to Merchant Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
