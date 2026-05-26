import { db } from '../db/connection';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyAuthentikJWT, AuthentikUserClaims } from '../utils/jwt';

// Mappings from Authentik groups to internal application roles
export type AppRole = 'super_admin' | 'product_admin' | 'support' | 'viewer' | 'owner' | 'child' | 'elder';

/**
 * Maps Authentik groups list to the corresponding application role
 */
function mapGroupsToRole(groups: string[] = []): AppRole {
  const normalizedGroups = groups.map(g => g.toLowerCase());
  
  if (normalizedGroups.includes('admin') || normalizedGroups.includes('superadmin')) {
    return 'super_admin';
  }
  if (normalizedGroups.includes('productadmin')) {
    return 'product_admin';
  }
  if (normalizedGroups.includes('support')) {
    return 'support';
  }
  if (normalizedGroups.includes('viewer')) {
    return 'viewer';
  }
  if (normalizedGroups.includes('owner') || normalizedGroups.includes('parent')) {
    return 'owner';
  }
  if (normalizedGroups.includes('child') || normalizedGroups.includes('dependent')) {
    return 'child';
  }
  if (normalizedGroups.includes('elder') || normalizedGroups.includes('senior')) {
    return 'elder';
  }
  
  // Default fallback role is 'owner'
  return 'owner';
}

/**
 * Syncs a user profile with the claims extracted from an Authentik JWT.
 * Implements JIT provisioning and merges accounts if they match by email.
 */
export async function syncUserWithJWT(jwtToken: string) {
  try {
    // 1. Verify the JWT and extract claims
    const claims = await verifyAuthentikJWT(jwtToken);
    
    if (!claims.sub || !claims.email) {
      throw new Error('JWT must contain sub (authentik_user_id) and email claims');
    }

    const mappedRole = mapGroupsToRole(claims.groups);

    // 2. Try lookup by Authentik User ID
    let user = await db.query.users.findFirst({
      where: eq(users.authentikUserId, claims.sub)
    });

    if (user) {
      // User exists, update claims if they changed
      const hasChanged = 
        user.email !== claims.email ||
        user.fullName !== (claims.name || null) ||
        user.phone !== (claims.phone || null) ||
        user.role !== mappedRole;

      if (hasChanged) {
        const [updatedUser] = await db.update(users)
          .set({
            email: claims.email,
            fullName: claims.name || null,
            phone: claims.phone || null,
            role: mappedRole,
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id))
          .returning();
        return updatedUser;
      }
      return user;
    }

    // 3. Fallback: Lookup by Email (handles pre-provisioned local profiles linking to Authentik on first login)
    user = await db.query.users.findFirst({
      where: eq(users.email, claims.email)
    });

    if (user) {
      // Link the existing local account to the Authentik User ID
      const [updatedUser] = await db.update(users)
        .set({
          authentikUserId: claims.sub,
          fullName: user.fullName || claims.name || null,
          phone: user.phone || claims.phone || null,
          role: mappedRole,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id))
        .returning();
      return updatedUser;
    }

    // 4. Provision a new unified user profile
    const [newUser] = await db.insert(users)
      .values({
        authentikUserId: claims.sub,
        email: claims.email,
        fullName: claims.name || null,
        phone: claims.phone || null,
        role: mappedRole,
        status: 'active'
      })
      .returning();

    return newUser;
  } catch (error: any) {
    // Encapsulate logging error details securely
    console.error('Error syncing user with JWT claims:', error.message);
    throw error;
  }
}
