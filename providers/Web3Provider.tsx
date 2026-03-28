'use client'

import '@rainbow-me/rainbowkit/styles.css'

import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { http } from 'viem'
import { sepolia } from 'wagmi/chains'
import { createConfig, WagmiProvider } from 'wagmi'
import { metaMask, walletConnect } from 'wagmi/connectors'

export function createWagmiConfig() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

  if (!projectId) {
    throw new Error(
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Add it to your .env.local file.'
    )
  }

  return createConfig({
    chains: [sepolia],
    connectors: [metaMask(), walletConnect({ projectId })],
    transports: {
      [sepolia.id]: http(),
    },
    ssr: true,
  })
}

export const wagmiConfig = createWagmiConfig()
const queryClient = new QueryClient()

interface Web3ProviderProps {
  children: React.ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
