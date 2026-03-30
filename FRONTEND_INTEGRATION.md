# Frontend Integration Guide - AjoFactory Contract

This guide explains how to integrate the deployed AjoFactory contract with your Next.js frontend.

## Quick Start

After deployment, the contract address and ABI are automatically saved to:

```
frontend/constants/deployments/sepolia-addresses.json
```

## Setup

### 1. Install ethers.js

If not already installed:

```bash
pnpm add ethers
```

### 2. Create Contract Hook

Create `hooks/useAjoFactory.ts`:

```typescript
import { ethers } from 'ethers'
import deployments from '@/constants/deployments/sepolia-addresses.json'

export function useAjoFactory() {
  const getContract = async () => {
    // Get signer from wallet (Metamask, etc)
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    
    const contract = new ethers.Contract(
      deployments.contracts.AjoFactory.address,
      deployments.contracts.AjoFactory.abi,
      signer
    )
    
    return contract
  }

  return { getContract }
}
```

### 3. Use in Components

#### Create Circle

```typescript
'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import { useAjoFactory } from '@/hooks/useAjoFactory'

export function CreateCircle() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState(2592000) // 30 days
  const [loading, setLoading] = useState(false)
  const { getContract } = useAjoFactory()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const contract = await getContract()
      
      const tx = await contract.createCircle(
        name,
        ethers.parseEther(amount), // Convert to Wei
        frequency
      )

      const receipt = await tx.wait()
      
      console.log('Circle created:', receipt)
      alert(`Circle created! TX: ${receipt.transactionHash}`)
      
      // Reset form
      setName('')
      setAmount('')
    } catch (error) {
      console.error('Error creating circle:', error)
      alert('Failed to create circle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCreate}>
      <input
        type="text"
        placeholder="Circle name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      
      <input
        type="number"
        placeholder="Contribution amount (ETH)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Circle'}
      </button>
    </form>
  )
}
```

#### Join Circle

```typescript
'use client'

import { useState } from 'react'
import { useAjoFactory } from '@/hooks/useAjoFactory'

export function JoinCircle({ circleId }: { circleId: number }) {
  const [loading, setLoading] = useState(false)
  const { getContract } = useAjoFactory()

  const handleJoin = async () => {
    setLoading(true)

    try {
      const contract = await getContract()
      const tx = await contract.joinCircle(circleId)
      const receipt = await tx.wait()
      
      console.log('Joined circle:', receipt)
      alert(`Joined circle! TX: ${receipt.transactionHash}`)
    } catch (error) {
      console.error('Error joining circle:', error)
      alert('Failed to join circle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleJoin} disabled={loading}>
      {loading ? 'Joining...' : 'Join Circle'}
    </button>
  )
}
```

#### Contribute to Circle

```typescript
'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import { useAjoFactory } from '@/hooks/useAjoFactory'

export function ContributeToCircle({ circleId }: { circleId: number }) {
  const [loading, setLoading] = useState(false)
  const { getContract } = useAjoFactory()

  const handleContribute = async () => {
    setLoading(true)

    try {
      const contract = await getContract()
      
      // Get circle details to know contribution amount
      const circle = await contract.getCircle(circleId)
      
      const tx = await contract.contributeToCircle(circleId, {
        value: circle.contributionAmount
      })
      
      const receipt = await tx.wait()
      console.log('Contribution received:', receipt)
      alert(`Contribution sent! TX: ${receipt.transactionHash}`)
    } catch (error) {
      console.error('Error contributing:', error)
      alert('Failed to contribute')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleContribute} disabled={loading}>
      {loading ? 'Contributing...' : 'Contribute'}
    </button>
  )
}
```

### 4. Get Circle Data

#### Read Circle Details

```typescript
async function getCircleDetails(circleId: number) {
  const provider = new ethers.JsonRpcProvider(
    'https://sepolia.infura.io/v3/YOUR_KEY'
  )
  
  const contract = new ethers.Contract(
    deployments.contracts.AjoFactory.address,
    deployments.contracts.AjoFactory.abi,
    provider
  )
  
  const circle = await contract.getCircle(circleId)
  
  return {
    name: circle.name,
    creator: circle.creator,
    contributionAmount: ethers.formatEther(circle.contributionAmount),
    members: circle.members,
    totalPooled: ethers.formatEther(circle.totalPooled),
    status: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'][circle.status]
  }
}
```

#### Get User's Circles

```typescript
async function getUserCircles(userAddress: string) {
  const provider = new ethers.JsonRpcProvider(
    'https://sepolia.infura.io/v3/YOUR_KEY'
  )
  
  const contract = new ethers.Contract(
    deployments.contracts.AjoFactory.address,
    deployments.contracts.AjoFactory.abi,
    provider
  )
  
  const circleIds = await contract.getUserCircles(userAddress)
  
  // Get details for each circle
  const circles = await Promise.all(
    circleIds.map((id: bigint) => contract.getCircle(id))
  )
  
  return circles
}
```

#### Check Circle Membership

```typescript
async function isMember(circleId: number, userAddress: string) {
  const provider = new ethers.JsonRpcProvider(
    'https://sepolia.infura.io/v3/YOUR_KEY'
  )
  
  const contract = new ethers.Contract(
    deployments.contracts.AjoFactory.address,
    deployments.contracts.AjoFactory.abi,
    provider
  )
  
  return await contract.isMember(circleId, userAddress)
}
```

## Environment Setup

Create `.env.local`:

```env
# For read-only operations
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_AJO_FACTORY_ADDRESS=0x...

# Optional: For API routes that need to interact with contract
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
```

Use in your app:

```typescript
const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL
const contractAddress = process.env.NEXT_PUBLIC_AJO_FACTORY_ADDRESS
```

## Error Handling

Common errors and how to handle them:

### Wallet Not Connected

```typescript
try {
  const contract = await getContract()
} catch (error) {
  if (error.code === 'CALL_EXCEPTION') {
    console.error('Wallet not connected')
    alert('Please connect your wallet first')
  }
}
```

### Insufficient Funds

```typescript
try {
  const tx = await contract.contributeToCircle(circleId, {
    value: amount
  })
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    alert('Insufficient funds in wallet')
  }
}
```

### Already Member

```typescript
try {
  const tx = await contract.joinCircle(circleId)
} catch (error) {
  if (error.reason?.includes('Already a member')) {
    alert('You are already a member of this circle')
  }
}
```

## Event Listening

Listen for contract events in real-time:

```typescript
function listenToCircleEvents(circleId: number) {
  const provider = new ethers.JsonRpcProvider(
    'https://sepolia.infura.io/v3/YOUR_KEY'
  )
  
  const contract = new ethers.Contract(
    deployments.contracts.AjoFactory.address,
    deployments.contracts.AjoFactory.abi,
    provider
  )

  // Listen to new contributions
  contract.on(
    'ContributionReceived',
    (circleId, contributor, amount, event) => {
      console.log(`New contribution: ${contributor} contributed ${amount} to circle ${circleId}`)
      // Update UI
    }
  )

  // Listen to member joins
  contract.on(
    'MemberJoined',
    (circleId, member, event) => {
      console.log(`New member: ${member} joined circle ${circleId}`)
      // Update UI
    }
  )

  // Clean up
  return () => {
    contract.removeAllListeners('ContributionReceived')
    contract.removeAllListeners('MemberJoined')
  }
}
```

## Gas Estimation

Estimate gas before sending transactions:

```typescript
async function estimateGas(circleId: number, amount: ethers.BigNumberish) {
  const contract = await getContract()
  
  try {
    const gasEstimate = await contract.contributeToCircle.estimateGas(
      circleId,
      { value: amount }
    )
    
    console.log(`Estimated gas: ${gasEstimate.toString()}`)
    console.log(`Estimated cost: ${ethers.formatEther(gasEstimate * BigInt('20'))} ETH`)
  } catch (error) {
    console.error('Gas estimation failed:', error)
  }
}
```

## Testing Contract Interactions

Use Hardhat to test contract interactions:

```bash
pnpm contract:test
```

See `test/AjoFactory.test.ts` for test examples.

## Deployment Details

**Network**: Sepolia Testnet
**Chain ID**: 11155111
**Explorer**: https://sepolia.etherscan.io

**Contract Address**: See `frontend/constants/deployments/sepolia-addresses.json`

## Support

- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)
- [Ethereum Development](https://ethereum.org/en/developers/)

## Next Steps

1. ✅ Deploy contract (`pnpm contract:deploy:sepolia`)
2. ✅ Create circular components
3. 🔄 Integrate with backend API
4. 🔄 Add transaction monitoring
5. 🧪 Test with real testnet ETH
6. 📱 Optimize for mobile
7. 🚀 Deploy to production

---

**Last Updated**: March 2024
