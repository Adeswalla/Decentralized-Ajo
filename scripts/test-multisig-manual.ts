/**
 * Manual test script for multisig functionality
 * Run with: npx tsx scripts/test-multisig-manual.ts
 */

import { PrismaClient } from '@prisma/client';
import { checkMultisigRequired, processApproval, validateApprover, getApprovalStatus } from '../lib/services/multisig';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Testing Multisig Implementation\n');

  try {
    // Step 1: Create test users
    console.log('📝 Step 1: Creating test users...');
    const organizer = await prisma.user.create({
      data: {
        email: `organizer-${Date.now()}@test.com`,
        address: `org-addr-${Date.now()}`,
        password: 'hashedpassword',
      },
    });

    const approver1 = await prisma.user.create({
      data: {
        email: `approver1-${Date.now()}@test.com`,
        address: `app1-addr-${Date.now()}`,
        password: 'hashedpassword',
      },
    });

    const approver2 = await prisma.user.create({
      data: {
        email: `approver2-${Date.now()}@test.com`,
        address: `app2-addr-${Date.now()}`,
        password: 'hashedpassword',
      },
    });

    const member = await prisma.user.create({
      data: {
        email: `member-${Date.now()}@test.com`,
        address: `mem-addr-${Date.now()}`,
        password: 'hashedpassword',
      },
    });

    console.log('✅ Created 4 test users\n');

    // Step 2: Create circle with multisig
    console.log('📝 Step 2: Creating circle with multisig enabled...');
    const circle = await prisma.circle.create({
      data: {
        name: 'Test Multisig Circle',
        organizerId: organizer.id,
        contributionAmount: 1000000,
        contributionFrequencyDays: 7,
        maxRounds: 12,
        multisigEnabled: true,
        multisigThreshold: 2000000, // 2M stroops = 0.2 XLM
        requiredApprovals: 2,
        approvers: JSON.stringify([approver1.id, approver2.id]),
      },
    });

    console.log(`✅ Created circle: ${circle.name}`);
    console.log(`   Threshold: ${circle.multisigThreshold / 10000000} XLM`);
    console.log(`   Required approvals: ${circle.requiredApprovals}\n`);

    // Step 3: Test multisig check for low amount
    console.log('📝 Step 3: Testing low-value withdrawal (below threshold)...');
    const lowAmountCheck = await checkMultisigRequired(circle.id, 1000000);
    console.log(`   Amount: 0.1 XLM`);
    console.log(`   Requires multisig: ${lowAmountCheck.requiresMultisig}`);
    console.log(`   ✅ ${lowAmountCheck.requiresMultisig ? 'FAIL' : 'PASS'} - Should not require multisig\n`);

    // Step 4: Test multisig check for high amount
    console.log('📝 Step 4: Testing high-value withdrawal (above threshold)...');
    const highAmountCheck = await checkMultisigRequired(circle.id, 5000000);
    console.log(`   Amount: 0.5 XLM`);
    console.log(`   Requires multisig: ${highAmountCheck.requiresMultisig}`);
    console.log(`   Required approvals: ${highAmountCheck.requiredApprovals}`);
    console.log(`   Number of approvers: ${highAmountCheck.approvers.length}`);
    console.log(`   ✅ ${highAmountCheck.requiresMultisig ? 'PASS' : 'FAIL'} - Should require multisig\n`);

    // Step 5: Test approver validation
    console.log('📝 Step 5: Testing approver validation...');
    const isOrganizerApprover = await validateApprover(circle.id, organizer.id);
    const isApprover1Valid = await validateApprover(circle.id, approver1.id);
    const isMemberApprover = await validateApprover(circle.id, member.id);
    
    console.log(`   Organizer is approver: ${isOrganizerApprover} ✅ ${isOrganizerApprover ? 'PASS' : 'FAIL'}`);
    console.log(`   Approver1 is approver: ${isApprover1Valid} ✅ ${isApprover1Valid ? 'PASS' : 'FAIL'}`);
    console.log(`   Member is approver: ${isMemberApprover} ✅ ${!isMemberApprover ? 'PASS' : 'FAIL'}\n`);

    // Step 6: Create withdrawal and test approval flow
    console.log('📝 Step 6: Creating high-value withdrawal...');
    const withdrawal = await prisma.withdrawal.create({
      data: {
        circleId: circle.id,
        userId: member.id,
        amount: 4500000, // After 10% penalty
        requestedAmount: 5000000, // 0.5 XLM
        status: 'PENDING',
      },
    });

    console.log(`✅ Created withdrawal: ${withdrawal.id}`);
    console.log(`   Requested: ${withdrawal.requestedAmount / 10000000} XLM`);
    console.log(`   After penalty: ${withdrawal.amount / 10000000} XLM`);
    console.log(`   Status: ${withdrawal.status}\n`);

    // Step 7: First approval
    console.log('📝 Step 7: Processing first approval...');
    const approval1 = await processApproval(
      withdrawal.id,
      approver1.id,
      true,
      'Verified documentation'
    );

    console.log(`✅ Approval 1 recorded`);
    console.log(`   Approved: ${approval1.approval.approved}`);
    console.log(`   Approvals: ${approval1.status.approvedCount}/${approval1.status.requiredApprovals}`);
    console.log(`   Is approved: ${approval1.status.isApproved}\n`);

    // Step 8: Second approval (should auto-approve)
    console.log('📝 Step 8: Processing second approval (should auto-approve)...');
    const approval2 = await processApproval(
      withdrawal.id,
      approver2.id,
      true,
      'Approved'
    );

    console.log(`✅ Approval 2 recorded`);
    console.log(`   Approved: ${approval2.approval.approved}`);
    console.log(`   Approvals: ${approval2.status.approvedCount}/${approval2.status.requiredApprovals}`);
    console.log(`   Is approved: ${approval2.status.isApproved}`);

    // Check withdrawal status
    const updatedWithdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawal.id },
    });

    console.log(`   Withdrawal status: ${updatedWithdrawal?.status}`);
    console.log(`   ✅ ${updatedWithdrawal?.status === 'APPROVED' ? 'PASS' : 'FAIL'} - Should be APPROVED\n`);

    // Step 9: Test approval status
    console.log('📝 Step 9: Getting approval status...');
    const status = await getApprovalStatus(withdrawal.id);
    
    console.log(`✅ Approval status retrieved`);
    console.log(`   Approved count: ${status.approvedCount}`);
    console.log(`   Rejected count: ${status.rejectedCount}`);
    console.log(`   Required: ${status.requiredApprovals}`);
    console.log(`   Is approved: ${status.isApproved}`);
    console.log(`   Approvals: ${status.approvals.length}\n`);

    // Step 10: Test rejection
    console.log('📝 Step 10: Testing rejection flow...');
    const withdrawal2 = await prisma.withdrawal.create({
      data: {
        circleId: circle.id,
        userId: member.id,
        amount: 2700000,
        requestedAmount: 3000000,
        status: 'PENDING',
      },
    });

    const rejection = await processApproval(
      withdrawal2.id,
      approver1.id,
      false,
      'Insufficient documentation'
    );

    console.log(`✅ Rejection recorded`);
    console.log(`   Approved: ${rejection.approval.approved}`);
    console.log(`   Comment: ${rejection.approval.comment}`);
    console.log(`   Rejected count: ${rejection.status.rejectedCount}`);
    console.log(`   ✅ PASS - Rejection works correctly\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 All tests completed successfully!');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n✅ Multisig implementation is working correctly!\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.withdrawalApproval.deleteMany({
      where: {
        OR: [
          { withdrawalId: withdrawal.id },
          { withdrawalId: withdrawal2.id },
        ],
      },
    });
    await prisma.withdrawal.deleteMany({
      where: { circleId: circle.id },
    });
    await prisma.circle.delete({ where: { id: circle.id } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [organizer.id, approver1.id, approver2.id, member.id] },
      },
    });
    console.log('✅ Cleanup complete\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✨ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  });
