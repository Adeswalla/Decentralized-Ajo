/**
 * Batch Contribution Example
 * 
 * This example demonstrates how to use the batch contribution feature
 * to process multiple contributions efficiently in a single transaction.
 */

import { ethers } from 'ethers';

// Example configuration
const CIRCLE_ID = 'your-circle-id';
const API_BASE_URL = 'https://your-api.com';
const AUTH_TOKEN = 'your-auth-token';

/**
 * Example 1: Batch contribute via API
 */
async function batchContributeViaAPI() {
  const contributions = [
    { userId: 'user-1', amount: 1000000 },
    { userId: 'user-2', amount: 1000000 },
    { userId: 'user-3', amount: 1000000 },
    { userId: 'user-4', amount: 1000000 },
    { userId: 'user-5', amount: 1000000 },
  ];

  try {
    const response = await fetch(`${API_BASE_URL}/api/circles/${CIRCLE_ID}/contribute/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contributions }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Batch contribution successful!');
    console.log(`📊 Processed ${result.count} contributions`);
    console.log(`🔄 Round progress: ${result.totalContributedThisRound}/${result.totalMembers}`);
    
    return result;
  } catch (error) {
    console.error('❌ Batch contribution failed:', error);
    throw error;
  }
}

/**
 * Example 2: Batch contribute via smart contract
 */
async function batchContributeViaContract() {
  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider('https://your-rpc-url');
  const wallet = new ethers.Wallet('your-private-key', provider);

  // Contract addresses
  const AJO_CIRCLE_ADDRESS = '0x...';
  const TOKEN_ADDRESS = '0x...';

  // Contract ABIs (simplified)
  const ajoCircleABI = [
    'function batchContribute(address[] calldata _members, uint256[] calldata _amounts) external',
  ];
  
  const tokenABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
  ];

  // Initialize contracts
  const ajoCircle = new ethers.Contract(AJO_CIRCLE_ADDRESS, ajoCircleABI, wallet);
  const token = new ethers.Contract(TOKEN_ADDRESS, tokenABI, wallet);

  // Prepare batch data
  const members = [
    '0x1234...', // member1 address
    '0x5678...', // member2 address
    '0x9abc...', // member3 address
  ];

  const contributionAmount = ethers.parseEther('100');
  const amounts = members.map(() => contributionAmount);
  const totalAmount = contributionAmount * BigInt(members.length);

  try {
    // Step 1: Approve tokens
    console.log('📝 Approving tokens...');
    const approveTx = await token.approve(AJO_CIRCLE_ADDRESS, totalAmount);
    await approveTx.wait();
    console.log('✅ Tokens approved');

    // Step 2: Execute batch contribution
    console.log('🚀 Executing batch contribution...');
    const batchTx = await ajoCircle.batchContribute(members, amounts);
    const receipt = await batchTx.wait();
    
    console.log('✅ Batch contribution successful!');
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`💰 Gas saved vs individual: ~${(receipt.gasUsed * BigInt(2)).toString()}`);
    
    return receipt;
  } catch (error) {
    console.error('❌ Batch contribution failed:', error);
    throw error;
  }
}

/**
 * Example 3: Compare gas costs
 */
async function compareGasCosts() {
  const provider = new ethers.JsonRpcProvider('https://your-rpc-url');
  const wallet = new ethers.Wallet('your-private-key', provider);

  const AJO_CIRCLE_ADDRESS = '0x...';
  const ajoCircleABI = [
    'function contribute(uint256 _amount) external',
    'function batchContribute(address[] calldata _members, uint256[] calldata _amounts) external',
  ];

  const ajoCircle = new ethers.Contract(AJO_CIRCLE_ADDRESS, ajoCircleABI, wallet);
  const contributionAmount = ethers.parseEther('100');

  // Estimate individual contribution gas
  const individualGas = await ajoCircle.contribute.estimateGas(contributionAmount);
  const totalIndividualGas = individualGas * BigInt(10);

  console.log(`⛽ Individual contribution gas (1 member): ${individualGas.toString()}`);
  console.log(`⛽ Total for 10 members individually: ${totalIndividualGas.toString()}`);

  // Estimate batch contribution gas
  const members = Array(10).fill('0x1234...');
  const amounts = Array(10).fill(contributionAmount);
  const batchGas = await ajoCircle.batchContribute.estimateGas(members, amounts);

  console.log(`⛽ Batch contribution gas (10 members): ${batchGas.toString()}`);
  
  const savings = totalIndividualGas - batchGas;
  const savingsPercent = (Number(savings) / Number(totalIndividualGas)) * 100;

  console.log(`💰 Gas saved: ${savings.toString()} (${savingsPercent.toFixed(2)}%)`);
}

/**
 * Example 4: Handle errors gracefully
 */
async function batchContributeWithErrorHandling() {
  const contributions = [
    { userId: 'user-1', amount: 1000000 },
    { userId: 'user-2', amount: 1000000 },
  ];

  try {
    const response = await fetch(`${API_BASE_URL}/api/circles/${CIRCLE_ID}/contribute/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contributions }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      switch (result.error) {
        case 'Unauthorized':
          console.error('❌ Authentication failed. Please check your token.');
          break;
        case 'Only the organizer can batch contribute':
          console.error('❌ Only the circle organizer can perform batch contributions.');
          break;
        case 'InvalidInput':
          console.error('❌ Invalid input:', result.message);
          console.error('Details:', result.details);
          break;
        default:
          console.error('❌ Error:', result.error);
      }
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Request failed:', error);
    throw error;
  }
}

/**
 * Example 5: Batch contribution with validation
 */
async function batchContributeWithValidation(
  circleId: string,
  contributions: Array<{ userId: string; amount: number }>
) {
  // Validate inputs
  if (contributions.length === 0) {
    throw new Error('At least one contribution is required');
  }

  if (contributions.length > 50) {
    throw new Error('Maximum 50 contributions per batch');
  }

  for (const contrib of contributions) {
    if (!contrib.userId) {
      throw new Error('User ID is required for each contribution');
    }
    if (contrib.amount <= 0) {
      throw new Error('Contribution amount must be positive');
    }
  }

  // Execute batch contribution
  return batchContributeViaAPI();
}

// Export examples
export {
  batchContributeViaAPI,
  batchContributeViaContract,
  compareGasCosts,
  batchContributeWithErrorHandling,
  batchContributeWithValidation,
};

// Example usage
if (require.main === module) {
  console.log('🚀 Batch Contribution Examples\n');
  
  // Uncomment to run examples
  // batchContributeViaAPI();
  // batchContributeViaContract();
  // compareGasCosts();
  // batchContributeWithErrorHandling();
}
