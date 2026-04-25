/**
 * Referral Program Page
 * Closes #608
 */

import { ReferralProgram } from '@/components/referral/referral-program';

export default function ReferralsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Referral Program</h1>
        <p className="text-muted-foreground">
          Invite friends and earn rewards when they join Stellar Ajo
        </p>
      </div>

      <ReferralProgram />
    </div>
  );
}
