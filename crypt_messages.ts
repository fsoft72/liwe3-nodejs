import { config_load } from './liwe';
import { ILRequest, ILResponse, ILiweConfig, LCback } from './types';
import * as jwt from 'jsonwebtoken';

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

import * as crypto from 'crypto';

// Encrypts the given payload using the provided secret message
export const cryptPayload = ( payload: any ): string => {
	const algorithm = 'aes-256-gcm';
	// generate a random number
	const num = Math.floor( Math.random() * 100000 );
	// convert the number in base 36 (numbers + letters), and uppercase it
	const numStr = num.toString( 36 );
	// convert the number to an md5 hash adding secret to it
	const hash = crypto.createHash( 'md5' ).update( numStr + cfg.security.secret ).digest( 'hex' );

	const iv = crypto.randomBytes( 16 ); // Generate a random initialization vector
	const key = crypto.scryptSync( cfg.security.remote, hash, 32 ); // Derive a key from the secret message using the scrypt key derivation function

	// convert the payload to a string
	payload = JSON.stringify( payload );

	const cipher = crypto.createCipheriv( algorithm, key, iv );
	let encrypted = cipher.update( payload, 'utf8', 'hex' );
	encrypted += cipher.final( 'hex' );

	const authTag = cipher.getAuthTag();
	return iv.toString( 'hex' ) + ':' + authTag.toString( 'hex' ) + ':' + numStr + ':' + encrypted;
};

// Decrypts the encrypted payload using the provided secret message
export const decryptPayload = ( encryptedPayload: string ): any | null => {
	const algorithm = 'aes-256-gcm';
	const components = encryptedPayload.split( ':' );
	if ( components.length !== 4 ) {
		return null; // Invalid input format
	}

	const iv = Buffer.from( components[ 0 ], 'hex' );
	const authTag = Buffer.from( components[ 1 ], 'hex' );
	const numStr = components[ 2 ];
	const encrypted = components[ 3 ];

	const hash = crypto.createHash( 'md5' ).update( numStr + cfg.security.secret ).digest( 'hex' );
	const key = crypto.scryptSync( cfg.security.remote, hash, 32 );

	const decipher = crypto.createDecipheriv( algorithm, key, iv );
	decipher.setAuthTag( authTag );

	try {
		let decrypted = decipher.update( encrypted, 'hex', 'utf8' );
		decrypted += decipher.final( 'utf8' );
		return JSON.parse( decrypted );
	} catch ( err ) {
		console.error( 'Decryption failed:', err );
		return null; // Decryption failed
	}
};


/**
 * Encrypt a message and sends it back to the server with ILResponse
 *
 * @param res  the ILResponse to send the answer to
 * @param payload the object to be encrypted
 */
export const message_send_encrypted = ( res: ILResponse, payload: any ) => {
	const q = cryptPayload( payload );
	res.send( { q } );
};

export const crypt_send_message = ( url: string, payload: any, secret: string, expires: number, cback: LCback ) => {
	const axios = require( "axios" );
	const crypted = cryptPayload( payload );

	axios.post( url, { q: crypted } )
		.then( ( resp: any ) => {
			const res = decryptPayload( resp.data.q );
			return cback( null, res );
		} )

		.catch( ( err: any ) => {
			return cback( err );
		} );
};
