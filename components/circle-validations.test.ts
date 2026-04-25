import {
  CreateCircleSchema,
  ContributeSchema,
  MIN_CONTRIBUTION_AMOUNT,
  MAX_CONTRIBUTION_AMOUNT,
  MIN_FREQUENCY_DAYS,
  MAX_FREQUENCY_DAYS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  HARD_CAP,
} from '@/lib/validations/circle';

describe('Circle validation boundaries mirror contract limits', () => {
  const baseCircle = {
    name: 'Alpha Circle',
    description: 'Boundary check circle',
    contributionAmount: MIN_CONTRIBUTION_AMOUNT,
    contributionFrequencyDays: MIN_FREQUENCY_DAYS,
    maxRounds: MIN_ROUNDS,
    maxMembers: HARD_CAP,
  };

  it('accepts exact lower bounds', () => {
    const result = CreateCircleSchema.safeParse(baseCircle);
    expect(result.success).toBe(true);
  });

  it('accepts exact upper bounds', () => {
    const result = CreateCircleSchema.safeParse({
      ...baseCircle,
      contributionAmount: MAX_CONTRIBUTION_AMOUNT,
      contributionFrequencyDays: MAX_FREQUENCY_DAYS,
      maxRounds: MAX_ROUNDS,
      maxMembers: HARD_CAP,
    });
    expect(result.success).toBe(true);
  });

  it('rejects values below lower bounds', () => {
    const result = CreateCircleSchema.safeParse({
      ...baseCircle,
      contributionAmount: MIN_CONTRIBUTION_AMOUNT - 1,
      contributionFrequencyDays: MIN_FREQUENCY_DAYS - 1,
      maxRounds: MIN_ROUNDS - 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects values above upper bounds', () => {
    const result = CreateCircleSchema.safeParse({
      ...baseCircle,
      contributionAmount: MAX_CONTRIBUTION_AMOUNT + 1,
      contributionFrequencyDays: MAX_FREQUENCY_DAYS + 1,
      maxRounds: MAX_ROUNDS + 1,
      maxMembers: HARD_CAP + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer contributions', () => {
    const result = ContributeSchema.safeParse({ amount: MIN_CONTRIBUTION_AMOUNT + 0.5 });
    expect(result.success).toBe(false);
  });
});
