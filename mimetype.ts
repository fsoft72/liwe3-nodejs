import { extname } from 'path';
import * as mime from 'mime-types';


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

export const ext = ( str: string ) => {
	return extname( str ).slice( 1 );
};

export const ext2mime = ( ext: string ) => {
	return mime.lookup( ext );
};
