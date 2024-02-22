import { extname } from 'path';
import * as mime from 'mime-types';


/**
 * Converts a MIME type to its corresponding file extension.
 * @param mimetype - The MIME type to convert.
 * @returns The file extension corresponding to the given MIME type.
 */
export const mime2ext = ( mimetype: string ) => {
	const part = mimetype.split( "/" )[ 1 ].toLowerCase();

	switch ( part ) {
		case "jpeg":
		case "jpg":
			return "jpg";

		case "javascript":
			return "js";

		case "pdf":
			return "pdf";

		default:
			return part;
	}
};

/**
 * Extracts the file extension from a given string.
 *
 * @param str - The input string.
 * @returns The file extension.
 */
export const ext = ( str: string ) => {
	return extname( str ).slice( 1 );
};

/**
 * Converts a file extension to a MIME type.
 * @param ext The file extension to convert.
 * @returns The corresponding MIME type for the given extension.
 */
export const ext2mime = ( ext: string ) => {
	let res = mime.lookup( ext );

	if ( res ) return res;

	return "application/octet-stream";
};
