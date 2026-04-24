import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as StellarSdk from '@stellar/stellar-sdk';
import { getSorobanClient, STELLAR_CONFIG } from '@/lib/stellar-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Basic security check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch all active circles with a deployed contract
    const activeCircles = await prisma.circle.findMany({
      where: {
        contractAddress: { not: null },
        status: 'ACTIVE',
      },
      include: {
        members: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    const report = {
      timestamp: new Date().toISOString(),
      checkedCount: activeCircles.length,
      discrepancies: [] as any[],
    };

    const server = getSorobanClient();
    
    // Create a dummy account for simulation purposes
    const dummyKeypair = StellarSdk.Keypair.random();
    const dummyAccount = new StellarSdk.Account(dummyKeypair.publicKey(), "0");

    for (const circle of activeCircles) {
      if (!circle.contractAddress) continue;
      
      try {
        const contract = new StellarSdk.Contract(circle.contractAddress);
        const tx = new StellarSdk.TransactionBuilder(dummyAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        })
          .addOperation(contract.call('get_circle_state'))
          .setTimeout(30)
          .build();

        const simulated = await server.simulateTransaction(tx as any);
        
        if (!simulated || !('result' in simulated) || !simulated.result || !simulated.result.retval) {
          report.discrepancies.push({
            circleId: circle.id,
            error: 'Failed to simulate or get return value from get_circle_state'
          });
          continue;
        }

        const onChainData = StellarSdk.scValToNative(simulated.result.retval);
        
        // Soroban Rust structs often decode as arrays in scValToNative.
        // We extract the fields based on their ordinal position in the struct:
        // [organizer, token_address, contribution_amount, frequency_days, max_rounds, current_round, member_count, max_members]
        let chainRound: number;
        let chainMembers: number;
        let chainAmount: string;

        if (Array.isArray(onChainData) && onChainData.length >= 7) {
          chainAmount = String(onChainData[2]);
          chainRound = Number(onChainData[5]);
          chainMembers = Number(onChainData[6]);
        } else if (typeof onChainData === 'object' && onChainData !== null) {
          chainAmount = String((onChainData as any).contribution_amount);
          chainRound = Number((onChainData as any).current_round);
          chainMembers = Number((onChainData as any).member_count);
        } else {
          throw new Error('Unknown struct format');
        }

        const dbRound = circle.currentRound;
        const dbMembers = circle.members.length;
        // Float in DB might have formatting issues when comparing to on-chain bigints, 
        // but we convert to string representation in stroops for comparison.
        const dbAmountStroops = (circle.contributionAmount * 10_000_000).toString();

        const deltas: Record<string, { db: any; chain: any }> = {};

        if (chainRound !== dbRound) {
          deltas.currentRound = { db: dbRound, chain: chainRound };
        }
        if (chainMembers !== dbMembers) {
          deltas.memberCount = { db: dbMembers, chain: chainMembers };
        }
        if (chainAmount !== dbAmountStroops) {
          deltas.contributionAmount = { db: dbAmountStroops, chain: chainAmount };
        }

        if (Object.keys(deltas).length > 0) {
          report.discrepancies.push({
            circleId: circle.id,
            contractAddress: circle.contractAddress,
            deltas
          });
        }
      } catch (err: any) {
        report.discrepancies.push({
          circleId: circle.id,
          error: `Error querying chain state: ${err.message}`
        });
      }
    }

    return NextResponse.json(report, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
