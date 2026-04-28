-- AlterEnum: Add DISSOLVED status to CircleStatus
ALTER TYPE "CircleStatus" ADD VALUE 'DISSOLVED';

-- AlterEnum: Add EMERGENCY_DISSOLUTION to ProposalType
ALTER TYPE "ProposalType" ADD VALUE 'EMERGENCY_DISSOLUTION';
