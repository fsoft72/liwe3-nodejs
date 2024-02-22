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

/**
 * Encrypts binary data using a secret key.
 *
 * @param data - The binary data to be encrypted.
 * @param secret - The secret key used for encryption.
 * @returns The encrypted binary data.
 *
 * @see decryptBinary
 */
export const encryptBinary = ( data: Buffer, secret: string ): Buffer => {
	const { key, iv } = buildKey( secret );
	const cipher = crypto.createCipheriv( algorithm, key, iv );
	const encrypted = Buffer.concat( [ cipher.update( data ), cipher.final() ] );
	return encrypted;
};

/**
 * Decrypts binary data using a secret key.
 *
 * @param encryptedData - The encrypted binary data to be decrypted.
 * @param secret - The secret key used for decryption.
 * @returns The decrypted binary data.
 *
 * @see encryptBinary
 */
export const decryptBinary = ( encryptedData: Buffer, secret: string ): Buffer => {
	const { key, iv } = buildKey( secret );
	const decipher = crypto.createDecipheriv( algorithm, key, iv );
	const decrypted = Buffer.concat( [ decipher.update( encryptedData ), decipher.final() ] );
	return decrypted;
};

/**
 * Encrypts a string using a secret key.
 * @param data - The string to be encrypted.
 * @param secret - The secret key used for encryption.
 * @returns The encrypted string in hexadecimal format.
 *
 * @see decryptString
 */
export const encryptString = ( data: string, secret: string ): string => {
	const { key, iv } = buildKey( secret );
	const cipher = crypto.createCipheriv( algorithm, key, iv );
	const encrypted = Buffer.concat( [ cipher.update( data ), cipher.final() ] );
	return encrypted.toString( 'hex' );
};

/**
 * Decrypts an encrypted string using a secret key.
 *
 * @param encryptedData - The encrypted string to be decrypted.
 * @param secret - The secret key used for decryption.
 * @returns The decrypted string.
 *
 * @see encryptString
 */
export const decryptString = ( encryptedData: string, secret: string ): string => {
	const { key, iv } = buildKey( secret );
	const decipher = crypto.createDecipheriv( algorithm, key, iv );
	const decrypted = Buffer.concat( [ decipher.update( encryptedData, 'hex' ), decipher.final() ] );
	return decrypted.toString();
};

/**
 * Encrypts a file using a secret key.
 *
 * @param input - The path to the input file.
 * @param output - The path to the output file.
 * @param secret - The secret key used for encryption.
 * @returns A Promise that resolves when the encryption is complete.
 *
 * @see decryptFile
 */
export const encryptFile = async ( input: string, output: string, secret: string ): Promise<void> => {
	const { key, iv } = buildKey( secret );
	const cipher = crypto.createCipheriv( algorithm, key, iv );

	const input_stream = fs.createReadStream( input );
	const output_stream = fs.createWriteStream( output );

	await pipeline( input_stream, cipher, output_stream );
};

/**
 * Decrypts a file using a secret key.
 *
 * @param input - The path of the input file to be decrypted.
 * @param output - The path of the output file where the decrypted content will be written.
 * @param secret - The secret key used for decryption.
 * @returns A Promise that resolves when the decryption is complete.
 *
 * @see encryptFile
 */
export const decryptFile = async ( input: string, output: string, secret: string ): Promise<void> => {
	const { key, iv } = buildKey( secret );
	const decipher = crypto.createDecipheriv( algorithm, key, iv );

	const input_stream = fs.createReadStream( input );
	const output_stream = fs.createWriteStream( output );

	await pipeline( input_stream, decipher, output_stream );
};


