import * as crypto from 'crypto';
import * as fs from 'fs';
import { pipeline } from 'stream/promises';

const algorithm = 'aes-256-cbc';

type encryptKeys = { key: Buffer; iv: Buffer; };

// Returns predictable key and iv based on baseKey
const buildKey = ( baseKey: string ): encryptKeys => {
	const key = crypto.createHash( 'sha256' ).update( baseKey ).digest();
	const iv = crypto.createHash( 'md5' ).update( key ).digest().slice( 0, 16 );

	return { key, iv };
};

export const encryptBinary = ( data: Buffer, secret: string ): Buffer => {
	const { key, iv } = buildKey( secret );
	const cipher = crypto.createCipheriv( algorithm, key, iv );
	const encrypted = Buffer.concat( [ cipher.update( data ), cipher.final() ] );
	return encrypted;
};

export const decryptBinary = ( encryptedData: Buffer, secret: string ): Buffer => {
	const { key, iv } = buildKey( secret );
	const decipher = crypto.createDecipheriv( algorithm, key, iv );
	const decrypted = Buffer.concat( [ decipher.update( encryptedData ), decipher.final() ] );
	return decrypted;
};

export const encryptString = ( data: string, secret: string ): string => {
	const { key, iv } = buildKey( secret );
	const cipher = crypto.createCipheriv( algorithm, key, iv );
	const encrypted = Buffer.concat( [ cipher.update( data ), cipher.final() ] );
	return encrypted.toString( 'hex' );
};

export const decryptString = ( encryptedData: string, secret: string ): string => {
	const { key, iv } = buildKey( secret );
	const decipher = crypto.createDecipheriv( algorithm, key, iv );
	const decrypted = Buffer.concat( [ decipher.update( encryptedData, 'hex' ), decipher.final() ] );
	return decrypted.toString();
};

export const encryptFile = async ( input: string, output: string, secret: string ): Promise<void> => {
	const { key, iv } = buildKey( secret );
	const cipher = crypto.createCipheriv( algorithm, key, iv );

	const input_stream = fs.createReadStream( input );
	const output_stream = fs.createWriteStream( output );

	await pipeline( input_stream, cipher, output_stream );
};

export const decryptFile = async ( input: string, output: string, secret: string ): Promise<void> => {
	const { key, iv } = buildKey( secret );
	const decipher = crypto.createDecipheriv( algorithm, key, iv );

	const input_stream = fs.createReadStream( input );
	const output_stream = fs.createWriteStream( output );

	await pipeline( input_stream, decipher, output_stream );
};


