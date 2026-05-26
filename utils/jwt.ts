import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const jwksUri = process.env.AUTHENTIK_JWKS_URI || 'http://localhost:9000/application/o/ptalk/.well-known/jwks.json';
const issuer = process.env.AUTHENTIK_ISSUER || 'http://localhost:9000/application/o/ptalk/';

// Create JWKS client
export const client = jwksClient({
  jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
});


// Key helper for jsonwebtoken to retrieve the signing public key
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error('No kid claim in JWT header'));
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AuthentikUserClaims {
  sub: string;         // Authentik User ID
  email: string;
  name?: string;
  phone?: string;
  groups?: string[];    // Groups in Authentik used for role mapping
  [key: string]: any;
}

/**
 * Verifies the Authentik JWT token and returns decoded claims.
 * Uses JWKS endpoint for signature verification and strictly enforces RS256.
 */
export function verifyAuthentikJWT(token: string): Promise<AuthentikUserClaims> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer,
        algorithms: ['RS256'], // Strictly enforce RS256, reject none algorithm
      },
      (err, decoded) => {
        if (err) {
          return reject(err);
        }
        resolve(decoded as AuthentikUserClaims);
      }
    );
  });
}
