// import * as multer from 'multer';
const multer = require( 'multer' );

import { upload_fullpath } from "./liwe";

const storage = multer.diskStorage( {
	destination ( req: Express.Request, file: any, cb: any ) {
		cb( null, upload_fullpath( "temp" ) );
	},

	filename ( req: Express.Request, file: any, cb: any ) {
		cb( null, Date.now().toString() );
	}
} );

export const upload = multer( { dest: upload_fullpath( "temp" ), storage } );
