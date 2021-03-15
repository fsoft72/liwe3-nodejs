import { extname } from 'path';

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
