/**
 * Backend API Routes for DecentralisedAjo
 * 
 * This module handles group management endpoints:
 * - GET /api/groups - Fetch all groups
 * - POST /api/groups - Create a new group (deploys Soroban contract)
 * - GET /api/groups/[id] - Fetch group details
 * - POST /api/groups/[id]/contribute - Submit contribution to group
 */

export async function GET(request: Request) {
  try {
    // In production, fetch from database
    // const groups = await db.groups.findAll()
    
    const groups = [
      {
        id: '1',
        name: 'Tech Friends Savings',
        totalPool: 50000,
        currency: 'XLM',
        members: 4,
        status: 'active',
        sorobanContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJW3Z5'
      }
    ]
    
    return Response.json({ groups })
  } catch (error) {
    return Response.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    if (!body.name || !body.description || !body.amount || !body.currency) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // In production:
    // 1. Save group to database
    // 2. Deploy Soroban contract using Stellar SDK
    // 3. Return contract ID
    
    const newGroup = {
      id: Date.now().toString(),
      name: body.name,
      description: body.description,
      amount: body.amount,
      currency: body.currency,
      frequency: body.frequency,
      maxMembers: body.maxMembers,
      payoutOrder: body.payoutOrder,
      sorobanContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJW3Z5',
      status: 'active',
      createdAt: new Date().toISOString()
    }
    
    return Response.json(newGroup, { status: 201 })
  } catch (error) {
    return Response.json({ error: 'Failed to create group' }, { status: 500 })
  }
}
