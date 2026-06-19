'use client'

import { useState } from 'react'
import { ChevronRight, CheckCircle } from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5

interface FormData {
  name: string
  description: string
  amount: string
  currency: 'XLM' | 'USDC'
  frequency: 'weekly' | 'biweekly' | 'monthly'
  maxMembers: string
  payoutOrder: 'random' | 'fixed'
}

export default function CreateGroup() {
  const [step, setStep] = useState<Step>(1)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    amount: '',
    currency: 'XLM',
    frequency: 'monthly',
    maxMembers: '5',
    payoutOrder: 'random',
  })

  const handleNext = () => {
    if (step < 5) setStep((step + 1) as Step)
  }

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step)
  }

  const handleInputChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    console.log('Creating group with data:', formData)
    // Here you would submit to the backend API
  }

  const steps = [
    { number: 1, title: 'Group Details' },
    { number: 2, title: 'Contribution Settings' },
    { number: 3, title: 'Cycle Timing' },
    { number: 4, title: 'Payout Order' },
    { number: 5, title: 'Review' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Create a Savings Group</h1>
        <p className="text-muted-foreground">Set up your community savings group in 5 easy steps</p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step >= s.number
                    ? 'bg-stellar text-stellar-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {step > s.number ? <CheckCircle size={20} /> : s.number}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-all ${
                    step > s.number ? 'bg-stellar' : 'bg-secondary'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Step {step} of 5 — {steps[step - 1].title}
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="glass rounded-lg p-8 border border-stellar/20 mb-8">
        {/* Step 1: Group Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Group Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Tech Friends Savings"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-secondary/20 border border-stellar/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-stellar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description <span className="text-danger">*</span>
              </label>
              <textarea
                placeholder="Describe your savings group's purpose..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-secondary/20 border border-stellar/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-stellar resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Contribution Settings */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Contribution Amount <span className="text-danger">*</span>
              </label>
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-secondary/20 border border-stellar/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-stellar"
                />
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value as 'XLM' | 'USDC')}
                  className="px-4 py-3 rounded-lg bg-secondary/20 border border-stellar/20 text-foreground focus:outline-none focus:ring-2 focus:ring-stellar"
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Cycle Timing */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Contribution Frequency <span className="text-danger">*</span>
              </label>
              <div className="space-y-3">
                {['weekly', 'biweekly', 'monthly'].map((freq) => (
                  <label
                    key={freq}
                    className="flex items-center p-4 rounded-lg border border-stellar/20 cursor-pointer hover:bg-secondary/10 transition-colors"
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={freq}
                      checked={formData.frequency === freq}
                      onChange={(e) => handleInputChange('frequency', e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="ml-3 font-medium text-foreground capitalize">{freq}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Payout Order */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Payout Order <span className="text-danger">*</span>
              </label>
              <div className="space-y-3">
                {[
                  { value: 'random', label: 'Random Order', desc: 'Payouts are randomly distributed' },
                  { value: 'fixed', label: 'Fixed Order', desc: 'Payouts follow a set rotation' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start p-4 rounded-lg border border-stellar/20 cursor-pointer hover:bg-secondary/10 transition-colors"
                  >
                    <input
                      type="radio"
                      name="payoutOrder"
                      value={option.value}
                      checked={formData.payoutOrder === option.value}
                      onChange={(e) => handleInputChange('payoutOrder', e.target.value as any)}
                      className="w-4 h-4 mt-1"
                    />
                    <div className="ml-3">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Max Members <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                min="2"
                max="100"
                value={formData.maxMembers}
                onChange={(e) => handleInputChange('maxMembers', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-secondary/20 border border-stellar/20 text-foreground focus:outline-none focus:ring-2 focus:ring-stellar"
              />
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Review Your Group</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/10 border border-stellar/20">
                <p className="text-sm text-muted-foreground">Group Name</p>
                <p className="text-lg font-semibold text-foreground">{formData.name}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/10 border border-stellar/20">
                <p className="text-sm text-muted-foreground">Contribution</p>
                <p className="text-lg font-semibold text-foreground">
                  {formData.amount} {formData.currency} / {formData.frequency}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/10 border border-stellar/20">
                <p className="text-sm text-muted-foreground">Payout Order</p>
                <p className="text-lg font-semibold text-foreground capitalize">{formData.payoutOrder}</p>
              </div>
              <div className="p-4 rounded-lg bg-stellar/20 border border-stellar/30">
                <p className="text-sm font-medium text-stellar">
                  ✓ Group will be deployed to Stellar as a Soroban smart contract
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="flex-1 px-6 py-3 rounded-lg border border-stellar/30 text-foreground font-medium hover:bg-secondary/10 transition-colors"
          >
            Back
          </button>
        )}
        {step < 5 ? (
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-stellar hover:bg-stellar/90 text-stellar-foreground font-medium transition-colors"
          >
            Next
            <ChevronRight size={20} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 rounded-lg bg-stellar hover:bg-stellar/90 text-stellar-foreground font-medium transition-colors"
          >
            Create Group
          </button>
        )}
      </div>
    </div>
  )
}
