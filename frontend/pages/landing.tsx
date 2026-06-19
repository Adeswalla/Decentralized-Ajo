'use client'

import Link from 'next/link'
import { ArrowRight, Zap, Users, TrendingUp, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-24">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-stellar/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo/5 rounded-full blur-3xl" />
        </div>

        <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6">
            <div className="glass px-4 py-2 rounded-full border border-stellar/30 flex items-center gap-2">
              <Zap size={16} className="text-stellar" />
              <span className="text-sm font-medium text-foreground">
                Community-Driven Savings
              </span>
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-balance">
            <span className="bg-gradient-to-r from-stellar to-indigo bg-clip-text text-transparent">
              Decentralised
            </span>
            <br />
            Savings Groups on Stellar
          </h1>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Join or create rotating savings groups powered by blockchain. Save together, earn together, 
            and access funds when you need them most—all transparent and secure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-stellar hover:bg-stellar/90 text-stellar-foreground font-semibold transition-all hover:shadow-lg hover:shadow-stellar/20"
            >
              Open Dashboard
              <ArrowRight size={20} />
            </Link>
            <Link
              href="/groups/create"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-lg glass border border-stellar/30 hover:border-stellar/50 hover:bg-card/60 font-semibold transition-all"
            >
              Create a Group
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: Users,
                title: 'Community Savings',
                description: 'Pool funds with friends and community members for faster financial growth',
              },
              {
                icon: Lock,
                title: 'Blockchain Secured',
                description: 'Stellar smart contracts ensure transparent, trustless fund management',
              },
              {
                icon: TrendingUp,
                title: 'Predictable Returns',
                description: 'Get guaranteed payouts every cycle with zero middleman fees',
              },
            ].map((feature, i) => {
              const Icon = feature.icon
              return (
                <div key={i} className="glass rounded-xl p-6 border border-stellar/20 hover:border-stellar/50 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-stellar/20 flex items-center justify-center mb-4 mx-auto">
                    <Icon className="text-stellar" size={24} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 border-t border-border">
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Savings?</h2>
          <p className="text-muted-foreground mb-8">
            Connect your Freighter wallet and join a savings revolution happening on Stellar.
          </p>
          <button className="flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-stellar hover:bg-stellar/90 text-stellar-foreground font-semibold mx-auto transition-all">
            <span>Connect Freighter Wallet</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </section>
    </main>
  )
}
