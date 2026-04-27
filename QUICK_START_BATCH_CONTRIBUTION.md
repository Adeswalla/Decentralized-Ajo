# Quick Start: Batch Contribution

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Circle organizer access
- Authentication token
- Multiple contributions to process

### Option 1: API (Recommended for Web Apps)

```typescript
// 1. Prepare your contributions
const contributions = [
  { userId: 'user-id-1', amount: 1000000 },
  { userId: 'user-id-2', amount: 1000000 },
  { userId: 'user-id-3', amount: 1000000 },
];

// 2. Make the API call
const response = await fetch('/api/circles/YOUR_CIRCLE_ID/contribute/batch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ contributions }),
});

// 3. Handle the response
const result = await response.json();
console.log(`✅ Processed ${result.count} contributions`);
```

### Option 2: Smart Contract (Direct Blockchain)

```typescript
import { ethers } from 'ethers';

// 1. Setup
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const ajoCircle = new ethers.Contract(CIRCLE_ADDRESS, ABI, wallet);
const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, wallet);

// 2. Prepare data
const members = ['0xAddress1', '0xAddress2', '0xAddress3'];
const amount = ethers.parseEther('100');
const amounts = members.map(() => amount);
const totalAmount = amount * BigInt(members.length);

// 3. Approve tokens
await token.approve(CIRCLE_ADDRESS, totalAmount);

// 4. Execute batch
const tx = await ajoCircle.batchContribute(members, amounts);
await tx.wait();
console.log('✅ Batch contribution complete!');
```

## 💡 Key Benefits

| Feature | Individual | Batch | Savings |
|---------|-----------|-------|---------|
| Gas (10 tx) | 1.36M | 436K | 68% |
| Transactions | 10 | 1 | 90% |
| Time | ~2 min | ~15 sec | 87% |
| Cost (50 gwei) | 0.068 ETH | 0.022 ETH | 0.046 ETH |

## ⚠️ Important Notes

1. **Organizer Only**: Only the circle organizer can batch contribute
2. **Batch Limit**: Maximum 50 contributions per batch
3. **Same Amount**: All contributions must match the circle's contribution amount
4. **Active Members**: All members must be active in the circle
5. **Token Approval**: Ensure sufficient token approval before calling

## 🔍 Common Use Cases

### Use Case 1: Monthly Contribution Collection
```typescript
// Collect all monthly contributions at once
const monthlyContributions = members.map(member => ({
  userId: member.id,
  amount: circle.contributionAmount
}));

await batchContribute(circleId, monthlyContributions);
```

### Use Case 2: Catch-up Contributions
```typescript
// Process multiple missed contributions
const missedContributions = getMissedContributions(circleId);
await batchContribute(circleId, missedContributions);
```

### Use Case 3: Automated Collection
```typescript
// Scheduled batch processing
cron.schedule('0 0 1 * *', async () => {
  const pendingContributions = await getPendingContributions();
  if (pendingContributions.length > 0) {
    await batchContribute(circleId, pendingContributions);
  }
});
```

## 🐛 Troubleshooting

### Error: "Unauthorized"
- Ensure you're the circle organizer
- Check your authentication token is valid

### Error: "InvalidInput"
- Verify all amounts match the circle's contribution amount
- Check batch size is between 1-50 contributions
- Ensure all user IDs are valid

### Error: "NotFound"
- Verify all users are members of the circle
- Check the circle ID is correct

### Error: "Insufficient allowance"
- Approve more tokens before calling batchContribute
- Total approval needed = amount × number of contributions

## 📊 Monitoring

### Check Gas Savings
```typescript
// Compare gas usage
const individualGas = await estimateIndividualGas(contributions.length);
const batchGas = await estimateBatchGas(contributions);
const savings = individualGas - batchGas;
console.log(`💰 Gas saved: ${savings} (${(savings/individualGas*100).toFixed(2)}%)`);
```

### Track Success Rate
```typescript
// Monitor batch success
const result = await batchContribute(circleId, contributions);
console.log(`✅ Success: ${result.count}/${contributions.length} contributions`);
```

## 🎯 Best Practices

1. **Batch Size**: Aim for 10-25 contributions per batch for optimal gas efficiency
2. **Validation**: Validate all inputs before calling the API
3. **Error Handling**: Implement retry logic for failed batches
4. **Monitoring**: Track gas savings and success rates
5. **Testing**: Test on testnet before production use

## 📚 Additional Resources

- Full Documentation: `BATCH_CONTRIBUTION_IMPLEMENTATION.md`
- Code Examples: `examples/batch-contribution-example.ts`
- Test Suite: `test/AjoCircle.batchContribute.test.ts`
- API Reference: `app/api/circles/[id]/contribute/batch/route.ts`

## 🆘 Need Help?

- Check the full documentation for detailed explanations
- Review the test suite for usage examples
- Examine the example code for common patterns
- Test on a development environment first

---

**Ready to save gas?** Start batching your contributions today! 🚀
