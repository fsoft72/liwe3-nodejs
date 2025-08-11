/**
 * Inspired by the original Ascii85 codec by Huan Du.
 * Copyright 2015 Huan Du. All rights reserved.
 * Licensed under the MIT license that can be found in the LICENSE file.
 *
 * This version has been modified to use TypeScript and Node.js conventions.
 * It includes type annotations, improved error handling, and better code organization.
 * It also supports custom encoding tables and options for delimiters and group spaces.
 * This code is designed to be used in a Node.js environment and is compatible with the Buffer API.
 * It is not intended to be used in a browser environment without further modifications.
 * This code is a complete implementation of an Ascii85 codec, including encoding and decoding methods.
 * It can be used to convert binary data to Ascii85 encoded strings and vice versa.
 * It supports custom encoding tables and options for delimiters and group spaces.
 *
 * Copyright (c) 2025 Fabio Rotondo.
 * Licensed under the MIT License.
 */

import { Buffer } from 'node:buffer';

// Constants are declared using `const` and are type-annotated for clarity.
const ASCII85_BASE = 85;
const ASCII85_CODE_START = 33;
const ASCII85_CODE_END = ASCII85_CODE_START + ASCII85_BASE;
const ASCII85_NULL = String.fromCharCode( 0 );
const ASCII85_NULL_STRING = ASCII85_NULL.repeat( 4 );
const ASCII85_ZERO = 'z';
const ASCII85_ZERO_VALUE = ASCII85_ZERO.charCodeAt( 0 );
const ASCII85_ENCODING_GROUP_LENGTH = 4;
const ASCII85_DECODING_GROUP_LENGTH = 5;
const ASCII85_BLOCK_START = '<~';
const ASCII85_BLOCK_START_VALUE = Buffer.from( ASCII85_BLOCK_START ).readUInt16BE( 0 );
const ASCII85_BLOCK_END = '~>';
const ASCII85_BLOCK_END_VALUE = Buffer.from( ASCII85_BLOCK_END ).readUInt16BE( 0 );
const ASCII85_GROUP_SPACE = 'y';
const ASCII85_GROUP_SPACE_VALUE = ASCII85_GROUP_SPACE.charCodeAt( 0 );
const ASCII85_GROUP_SPACE_CODE = 0x20202020;
const ASCII85_GROUP_SPACE_STRING = '    ';

// The default tables are now read-only to prevent accidental modification.
const ASCII85_DEFAULT_ENCODING_TABLE: readonly string[] = Array.from(
	{ length: ASCII85_BASE },
	( _, i ) => String.fromCharCode( ASCII85_CODE_START + i )
);

const ASCII85_DEFAULT_DECODING_TABLE: readonly number[] = ( () => {
	const arr: number[] = new Array( 1 << 8 );
	for ( let i = 0; i < ASCII85_BASE; i++ ) {
		arr[ ASCII85_CODE_START + i ] = i;
	}
	return arr;
} )();

// Define an interface for the options object to ensure type safety.
interface Ascii85Options {
	table?: string[];
	delimiter?: boolean;
	groupSpace?: boolean;
}

// Private interface to hold the tables for the codec instance.
interface Ascii85CodecTables {
	encodingTable: readonly string[];
	decodingTable: readonly number[];
}

/**
 * Creates a new Ascii85 codec.
 * @param options A list of chars for encoding or an option object.
 */
class Ascii85 {
	private _options: Ascii85Options;
	private readonly _tables: Ascii85CodecTables;

	constructor ( options: Ascii85Options = {} ) {
		this._options = options;
		const { table } = options;

		if ( table && Array.isArray( table ) ) {
			const decodingTable: number[] = [];
			table.forEach( ( v, i ) => {
				decodingTable[ v.charCodeAt( 0 ) ] = i;
			} );

			this._tables = {
				encodingTable: table,
				decodingTable: decodingTable
			};
		} else {
			this._tables = {
				encodingTable: ASCII85_DEFAULT_ENCODING_TABLE,
				decodingTable: ASCII85_DEFAULT_DECODING_TABLE
			};
		}
	}

	/**
	 * Encodes binary data to an ascii85 string.
	 * @param data A string or Buffer.
	 * @param options An options object.
	 * @returns A Buffer containing the encoded data.
	 */
	public encode ( data: string | Buffer, options: Ascii85Options = {} ): Buffer {
		let buf: Buffer;

		if ( typeof data === 'string' ) {
			buf = Buffer.from( data, 'binary' );
		} else if ( Buffer.isBuffer( data ) ) {
			buf = data;
		} else {
			// Handle other potential data types, although the original code assumes
			// string or buffer. This makes the code more robust.
			throw new Error( 'Unsupported data type for encoding.' );
		}

		// Merge instance options with method options.
		const effectiveOptions = { ...this._options, ...options };
		const { encodingTable, decodingTable } = this._tables;
		const table = effectiveOptions.table || encodingTable;
		const delimiter = !!effectiveOptions.delimiter;
		const groupSpace = !!effectiveOptions.groupSpace;

		// Use a Uint8Array for a mutable buffer of bytes.
		const bytes = new Uint8Array( 5 );
		const outputBufferLength = Math.ceil( buf.length * ASCII85_DECODING_GROUP_LENGTH / ASCII85_ENCODING_GROUP_LENGTH ) +
			ASCII85_DECODING_GROUP_LENGTH +
			( delimiter ? ASCII85_BLOCK_START.length + ASCII85_BLOCK_END.length : 0 );
		const output = Buffer.allocUnsafe( outputBufferLength );

		let offset = 0;

		if ( delimiter ) {
			offset += output.write( ASCII85_BLOCK_START, offset );
		}

		let digits = 0;
		let cur = 0;

		for ( const b of buf ) {
			cur *= 1 << 8;
			cur += b;
			digits++;

			if ( digits % ASCII85_ENCODING_GROUP_LENGTH ) {
				continue;
			}

			if ( groupSpace && cur === ASCII85_GROUP_SPACE_CODE ) {
				offset += output.write( ASCII85_GROUP_SPACE, offset );
			} else if ( cur ) {
				let tempCur = cur;
				for ( let j = ASCII85_ENCODING_GROUP_LENGTH; j >= 0; j-- ) {
					const r = tempCur % ASCII85_BASE;
					bytes[ j ] = r;
					tempCur = Math.floor( tempCur / ASCII85_BASE );
				}

				for ( let j = 0; j < ASCII85_DECODING_GROUP_LENGTH; j++ ) {
					offset += output.write( table[ bytes[ j ] ], offset );
				}
			} else {
				offset += output.write( ASCII85_ZERO, offset );
			}

			cur = 0;
			digits = 0;
		}

		if ( digits ) {
			const padding = ASCII85_ENCODING_GROUP_LENGTH - digits;

			if ( cur ) {
				let tempCur = cur;
				for ( let i = 0; i < padding; i++ ) {
					tempCur *= 1 << 8;
				}

				for ( let j = ASCII85_ENCODING_GROUP_LENGTH; j >= 0; j-- ) {
					const r = tempCur % ASCII85_BASE;
					bytes[ j ] = r;
					tempCur = Math.floor( tempCur / ASCII85_BASE );
				}

				for ( let j = 0; j < ASCII85_DECODING_GROUP_LENGTH; j++ ) {
					offset += output.write( table[ bytes[ j ] ], offset );
				}

				offset -= padding;
			} else {
				for ( let i = 0; i < digits + 1; i++ ) {
					offset += output.write( table[ 0 ], offset );
				}
			}
		}

		if ( delimiter ) {
			offset += output.write( ASCII85_BLOCK_END, offset );
		}

		return output.subarray( 0, offset );
	}

	/**
	 * Decodes an ascii85 string to binary data.
	 * @param str A string or Buffer.
	 * @param table An optional decoding table.
	 * @returns A Buffer containing the decoded data.
	 */
	public decode ( str: string | Buffer, table?: readonly number[] | { table: readonly number[]; } ): Buffer {
		let buf: Buffer;

		if ( typeof str === 'string' ) {
			buf = Buffer.from( str );
		} else if ( Buffer.isBuffer( str ) ) {
			buf = str;
		} else {
			throw new Error( 'Unsupported data type for decoding.' );
		}

		let decodingTable: readonly number[];
		let enableZero: boolean;
		let enableGroupSpace: boolean;

		if ( table ) {
			if ( 'table' in table ) {
				decodingTable = table.table;
			} else {
				decodingTable = table;
			}
		} else {
			decodingTable = this._tables.decodingTable;
		}

		enableZero = decodingTable[ ASCII85_ZERO_VALUE ] === undefined;
		enableGroupSpace = decodingTable[ ASCII85_GROUP_SPACE_VALUE ] === undefined;

		let totalZeroes = 0;
		if ( enableZero || enableGroupSpace ) {
			for ( const charCode of buf ) {
				if ( enableZero && charCode === ASCII85_ZERO_VALUE ) {
					totalZeroes++;
				}
				if ( enableGroupSpace && charCode === ASCII85_GROUP_SPACE_VALUE ) {
					totalZeroes++;
				}
			}
		}

		const outputBufferLength = Math.ceil( buf.length * ASCII85_ENCODING_GROUP_LENGTH / ASCII85_DECODING_GROUP_LENGTH ) +
			totalZeroes * ASCII85_ENCODING_GROUP_LENGTH +
			ASCII85_DECODING_GROUP_LENGTH;

		const output = Buffer.allocUnsafe( outputBufferLength );
		let offset = 0;
		let workingBuf = buf;

		if ( workingBuf.length >= ASCII85_BLOCK_START.length + ASCII85_BLOCK_END.length &&
			workingBuf.readUInt16BE( 0 ) === ASCII85_BLOCK_START_VALUE ) {
			let endIndex = -1;
			for ( let i = workingBuf.length - ASCII85_BLOCK_END.length; i >= 0; i-- ) {
				if ( workingBuf.readUInt16BE( i ) === ASCII85_BLOCK_END_VALUE ) {
					endIndex = i;
					break;
				}
			}

			if ( endIndex === -1 || endIndex <= ASCII85_BLOCK_START.length ) {
				throw new Error( 'Invalid ascii85 string delimiter pair.' );
			}

			workingBuf = workingBuf.subarray( ASCII85_BLOCK_START.length, endIndex );
		}

		let digits = 0;
		let cur = 0;
		for ( const charCode of workingBuf ) {
			if ( enableZero && charCode === ASCII85_ZERO_VALUE ) {
				offset += output.write( ASCII85_NULL_STRING, offset );
				digits = 0;
				cur = 0;
				continue;
			}

			if ( enableGroupSpace && charCode === ASCII85_GROUP_SPACE_VALUE ) {
				offset += output.write( ASCII85_GROUP_SPACE_STRING, offset );
				digits = 0;
				cur = 0;
				continue;
			}

			const decodedValue = decodingTable[ charCode ];
			if ( decodedValue === undefined ) {
				continue;
			}

			cur = cur * ASCII85_BASE + decodedValue;
			digits++;

			if ( digits === ASCII85_DECODING_GROUP_LENGTH ) {
				output.writeUInt32BE( cur, offset );
				offset += ASCII85_ENCODING_GROUP_LENGTH;
				cur = 0;
				digits = 0;
			}
		}

		if ( digits ) {
			const padding = ASCII85_DECODING_GROUP_LENGTH - digits;
			cur = cur * ( ASCII85_BASE ** padding );

			for ( let i = ASCII85_ENCODING_GROUP_LENGTH - 1; i >= padding; i-- ) {
				const byte = ( cur >>> ( i * 8 ) ) & 0xFF;
				output.writeUInt8( byte, offset++ );
			}
		}

		return output.subarray( 0, offset );
	}
}

// Add specific codecs as static properties for convenience.
export const ZeroMQ = new Ascii85( {
	table: [
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
		'.', '-', ':', '+', '=', '^', '!', '/', '*', '?', '&', '<', '>', '(', ')', '[', ']', '{', '}', '@', '%', '$', '#'
	]
} );

export const PostScript = new Ascii85( {
	delimiter: true
} );

// We can export the class itself.
export { Ascii85 };

export default new Ascii85();