import { generateServiceToken, verifyToken } from '../lib/auth';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function test() {
  console.log('--- Service Token Test ---');
  
  // 1. Generate a service token with 'user:read' scope
  const serviceName = 'notification-service';
  const scopes = ['user:read'];
  const token = generateServiceToken(serviceName, scopes);
  
  console.log('Generated Token:', token);
  
  // 2. Locally verify it
  const payload = verifyToken(token);
  console.log('Decoded Payload:', JSON.stringify(payload, null, 2));
  
  if (payload && payload.type === 'service' && payload.serviceName === serviceName) {
    console.log('✅ Local verification successful!');
  } else {
    console.error('❌ Local verification failed!');
    process.exit(1);
  }

  console.log('\nTo test against the live API, run:');
  console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/users/profile`);
}

test().catch(console.error);
