/**
 * First Campaign Tutorial Component
 * Closes #619
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Target, Users, Calendar, DollarSign, CheckCircle2, ArrowRight } from 'lucide-react';

interface FirstCampaignTutorialProps {
  onComplete?: () => void;
}

const tutorialSteps = [
  {
    icon: Target,
    title: 'Define Your Campaign Goal',
    description: 'Set a clear objective for your campaign - whether it\'s customer acquisition, brand awareness, or product launch.',
    tips: ['Be specific about what you want to achieve', 'Set measurable targets', 'Align with your business objectives'],
  },
  {
    icon: Users,
    title: 'Choose Your Target Audience',
    description: 'Select the demographics and interests of users you want to reach with your campaign.',
    tips: ['Consider your ideal customer profile', 'Use location and interest targeting', 'Start broad, then refine'],
  },
  {
    icon: DollarSign,
    title: 'Set Your Budget',
    description: 'Determine how much you want to spend and how you want to allocate your budget.',
    tips: ['Start with a test budget', 'Monitor performance daily', 'Adjust based on results'],
  },
  {
    icon: Calendar,
    title: 'Schedule Your Campaign',
    description: 'Choose when your campaign should run and for how long.',
    tips: ['Consider peak engagement times', 'Allow time for optimization', 'Plan for seasonal trends'],
  },
];

export function FirstCampaignTutorial({ onComplete }: FirstCampaignTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleNextStep = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));

    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentTutorial = tutorialSteps[currentStep];
  const Icon = currentTutorial.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle>Create Your First Campaign</CardTitle>
        </div>
        <CardDescription>
          Learn the basics of campaign creation in just a few minutes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between">
          {tutorialSteps.map((_, index) => (
            <div key={index} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  completedSteps.has(index)
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStep
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {completedSteps.has(index) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < tutorialSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    completedSteps.has(index) ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Tutorial Content */}
        <div className="space-y-6 py-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold">{currentTutorial.title}</h3>
              <p className="text-muted-foreground">{currentTutorial.description}</p>
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Pro Tips</Badge>
            </div>
            <ul className="space-y-2">
              {currentTutorial.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>

          <Button onClick={handleNextStep}>
            {currentStep === tutorialSteps.length - 1 ? (
              <>
                Complete Tutorial
                <CheckCircle2 className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Skip Option */}
        {currentStep < tutorialSteps.length - 1 && (
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={onComplete}>
              Skip Tutorial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
