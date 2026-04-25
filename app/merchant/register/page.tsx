/**
 * Merchant Registration Page
 * Closes #619
 */

import { MerchantRegistrationFlow } from '@/components/merchant/merchant-registration-flow';

export default function MerchantRegisterPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <MerchantRegistrationFlow />
    </div>
  );
}
