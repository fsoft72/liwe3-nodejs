
import { LCback } from './types';
import { shell } from './utils';

interface ImageSize {
	width: number | undefined;
	height: number | undefined;
}

/**
 *  resize - resizes the given image to the desider width / height maintaining aspect ratio or scaling fixed.
 *  At least width or height MUST be defined.
 *
 *  @param src_path - the original image file to be scaled (full path + filename)
 *  @param dest_path - the destination path where to save the scaled image (full path + filename)
 *  @param width - the desired image width in px (can be 0 if you want to scale on height) [0]
 *  @param height - the desired image height in px (can be 0 if you want to scale on width) [0]
 *  @param cback - Callback to be called on completion
 */
export const resize = ( src_path: string, dest_path: string, width: number = 0, height: number = 0, cback: LCback = undefined ) => {
	const sharp = require( 'sharp' );

	return new Promise( ( resolve, reject ) => {
		const img = sharp( src_path );
		const size: ImageSize = { width: undefined, height: undefined };

		if ( width ) size.width = width;
		if ( height ) size.height = height;

		return img.resize( size )
			.toFile( dest_path, ( err: Error, info: any ) => {
				if ( err ) return cback ? cback( err ) : reject( err );

				return cback ? cback( null, info ) : resolve( info );
			} );
	} );
};

export const mk_thumb = ( src_path: string, dest_path: string, ext: string, width: number = 0, height: number = 0, cback: LCback = undefined ) => {
	let cmd: string = '';
	const n = width > 0 ? width : height;

	switch ( ext ) {
		case 'jpg':
		case 'png':
		case 'webp':
			resize( src_path, dest_path, width, height, cback );
			break;

		case 'pdf':
			dest_path = dest_path.replace( ".jpg", "" );
			cmd = `pdftoppm -singlefile -scale-to ${ n } -jpeg "${ src_path }" "${ dest_path }" `;
			shell( cmd, cback );
			break;
	}
};
