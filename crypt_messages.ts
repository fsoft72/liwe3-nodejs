// import { default as fetch } from 'node-fetch';



import { config_load } from './liwe';
import { ILiweConfig } from './types';

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

import * as crypto from 'crypto';
import { challenge_create } from './utils';
import { error } from './console_colors';

/**
 * Encrypts the payload using AES-256-GCM encryption algorithm.
 *
 * @param payload - The payload to be encrypted.
 * @returns The encrypted payload as a string.
 *
 * @see decryptPayload
 * @see cryptMessage
 */
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

/**
 * Decrypts an encrypted payload.
 * @param encryptedPayload The encrypted payload to decrypt.
 * @returns The decrypted payload as an object, or null if decryption fails or the input format is invalid.
 *
 * @see cryptPayload
 */
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

type CryptedMessage = {
	cryptedBlock: string;
	challenge: string;
};

/**
 * Encrypts a message payload and creates a challenge.
 * @param payload The message payload to be encrypted.
 * @returns An object containing the encrypted block and the challenge.
 *
 * @see cryptPayload
 * @see decryptMessage
 */
export const cryptMessage = ( payload: any ): CryptedMessage => {
	const cryptedBlock = cryptPayload( payload );
	const challenge = challenge_create( [ cryptedBlock ] );

	return { cryptedBlock, challenge };
};

/**
 * Sends a cryptographically encrypted message to the specified URL.
 * @param fullURL The URL to send the message to.
 * @param payload The payload to be sent.
 * @returns A Promise that resolves to the decrypted response from the server.
 *
 * @see cryptMessage
 * @see decryptMessage
 */
export const cryptSend = async ( fullURL: string, payload: any ): Promise<any> => {
	// send data to the blockchain server in a POST request using fetch
	const response = await fetch( fullURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify( cryptMessage( payload ) ),
	} );

	const json: any = await response.json();

	if ( json.error ) {
		error( 'cryptSend error:', json.error );
		return null;
	}

	return decryptMessage( json );
};

/**
 * Decrypts a crypted message.
 * @param cryptedMessage - The crypted message to decrypt.
 * @returns The decrypted payload or null if the challenge mismatched.
 *
 * @see cryptMessage
 * @see cryptSend
 * @see cryptPayload
 * @see decryptPayload
 */
export const decryptMessage = ( cryptedMessage: CryptedMessage ): any | null => {
	const { cryptedBlock, challenge } = cryptedMessage;
	const check_challenge = challenge_create( [ cryptedBlock ] );

	if ( check_challenge !== challenge ) {
		error( 'decryptMessage error: challenge mismatch' );
		return null;
	}

	const payload = decryptPayload( cryptedBlock );
	return payload;
};