import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { db } from './db/connection';
import { users, userRelationships, devices } from './db/schema';
import { syncUserWithJWT } from './services/authService';
import { eq } from 'drizzle-orm';

// 1. Generate a real test RSA 2048-bit keypair for RS256 JWT signing & verification
console.log('Generating RSA keypair for testing...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

import { client } from './utils/jwt';

// 2. Stub the JWKS Client instance to return our test public key in-memory
// This completely avoids any external network calls to Authentik, keeping tests isolated.
console.log('Stubbing jwks-rsa client instance...');
client.getSigningKey = function (
  kid: string | null | undefined,
  cb?: (err: Error | null, key?: jwksRsa.SigningKey) => void
): any {
  if (cb) {
    cb(null, {
      kid: kid || 'test-kid-1234',
      getPublicKey: () => publicKey
    } as any);
  }
};



async function runTest() {
  console.log('\n--- STARTING INTEGRATION & SYNC TESTS ---');

  try {
    // 3. Create a test JWT representing a new Authentik user
    const claims = {
      sub: 'u9999999-9999-9999-9999-999999999999',
      email: 'verified_jwt_user@ptalk.vn',
      name: 'Nguyễn Tiến JWT',
      phone: '0977665544',
      groups: ['owner', 'parent'],
      iss: 'http://localhost:9000/application/o/ptalk/'
    };

    // Sign the token with our test private key (RS256)
    const token = jwt.sign(claims, privateKey, {
      algorithm: 'RS256',
      keyid: 'test-kid-1234',
      expiresIn: '1h'
    });

    console.log('Test JWT signed successfully.');

    // 4. Test 1: Just-In-Time (JIT) Provisioning
    console.log('\nTest 1: Syncing NEW user from JWT...');
    const syncedUser = await syncUserWithJWT(token);
    console.log('Synced User profile created:', {
      id: syncedUser.id,
      authentikUserId: syncedUser.authentikUserId,
      email: syncedUser.email,
      fullName: syncedUser.fullName,
      role: syncedUser.role,
      status: syncedUser.status
    });

    if (syncedUser.email !== claims.email || syncedUser.role !== 'owner') {
      throw new Error('Test 1 failed: claims were not synced properly');
    }
    console.log('✅ Test 1 Passed: New user provisioned and claims synchronized.');

    // 5. Test 2: Claim Updates (Upsert/Sync on changed groups/name)
    console.log('\nTest 2: Syncing SAME user with CHANGED claims (Promoting to admin)...');
    const updatedClaims = {
      ...claims,
      name: 'Nguyễn Tiến JWT (Updated)',
      groups: ['admin'] // Maps to 'super_admin'
    };

    const updatedToken = jwt.sign(updatedClaims, privateKey, {
      algorithm: 'RS256',
      keyid: 'test-kid-1234',
      expiresIn: '1h'
    });

    const updatedUser = await syncUserWithJWT(updatedToken);
    console.log('Synced User profile updated:', {
      id: updatedUser.id,
      authentikUserId: updatedUser.authentikUserId,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      updatedAt: updatedUser.updatedAt
    });

    if (updatedUser.fullName !== 'Nguyễn Tiến JWT (Updated)' || updatedUser.role !== 'super_admin') {
      throw new Error('Test 2 failed: claims changes were not updated');
    }
    console.log('✅ Test 2 Passed: Existing user profile synchronized with updated claims.');

    // 6. Test 3: Relationship Verification
    console.log('\nTest 3: Querying database relationships & schema verification...');
    
    // Fetch all users
    const allUsers = await db.query.users.findMany();
    console.log(`Total users in DB: ${allUsers.length}`);

    // Fetch the seed relationships
    const relationships = await db.query.userRelationships.findMany({
      with: {
        owner: true,
        dependent: true
      }
    });

    console.log(`Active Owner <-> Dependent relationships found: ${relationships.length}`);
    for (const rel of relationships) {
      console.log(`- Owner [${rel.owner.fullName}] is a [${rel.relationshipType}] for dependent [${rel.dependent.fullName}]`);
    }

    // Fetch devices with active configurations
    const allDevices = await db.query.devices.findMany({
      with: {
        configuration: true,
        owner: true,
        assignedUser: true
      }
    });

    console.log(`\nActive Devices list: ${allDevices.length}`);
    for (const d of allDevices) {
      console.log(`- Device [${d.serialNumber}] (${d.status})`);
      console.log(`  Owner: ${d.owner?.fullName || 'None'}`);
      console.log(`  Assigned User: ${d.assignedUser?.fullName || 'None'}`);
      console.log(`  Voice Config: ${d.configuration?.voice || 'Default'}`);
    }

    console.log('\n✅ Test 3 Passed: Schema relations queried successfully.');
    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTest();
