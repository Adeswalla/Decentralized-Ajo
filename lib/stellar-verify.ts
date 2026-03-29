import { Horizon } from '@stellar/stellar-sdk';
import { prisma } from '@/lib/prisma';

// Initialize the Horizon server using your env variable
const server = new Horizon.Server(process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL!);

export async function verifyStellarTx(txHash: string, ajoId: string) {
  try {
    // Query the network for the specific transaction
    const tx = await server.transactions().transaction(txHash).call();
    
    // Update DB based on on-chain status
    if (tx.successful) {
      await prisma.circle.update({
        where: { id: ajoId },
        data: { status: 'CONFIRMED' }
      });
    } else {
      await prisma.circle.update({
        where: { id: ajoId },
        data: { status: 'FAILED' }
      });
    }
  } catch (error: any) {
    console.error(`Verification failed for tx ${txHash}:`, error);
    
    // If the transaction isn't found (404), it might have dropped or failed
    if (error.response?.status === 404) {
        await prisma.circle.update({
            where: { id: ajoId },
            data: { status: 'FAILED' } // Or 'NOT_FOUND' depending on your schema
        });
    }
  }
}