import { mkid } from "./utils";
import { mkdir, move } from "./fs";
import { ILRequest } from "./types";
import * as mime from 'mime-types';

export interface UploadInfo {
	/** The file path */
	path: string;
	/** The file size */
	size: number;
	/** The file type */
	type: string;
	/** The file name */
	name: string;
	/** The file extension */
	ext: string;
	/** the reference to the file */
	file?: any;

	/** MD5 hash of the file */
	md5?: string;
}

/**
 * Parameters:
 *
 * @param req	- The Request object
 * @param filed_name - The field name in the POST request
 * @param dest_path  - The destination path (no file name, path only)
 * @param filename - The filename used to save the file (optional)
 * @param base_id   - The base name used to create the unique id (if not filename specified)
 */
export const upload_move = ( req: ILRequest, field_name: string, dest_path: string, filename?: string, base_id = 'file' ) => {
	const finfo = upload_info( req, field_name );

	if ( !finfo.size ) return null;

	mkdir( dest_path );

	if ( !filename ) filename = mkid( base_id ) + "." + finfo.ext;
	const full_filename = dest_path + "/" + filename;

	move( finfo.path, dest_path + "/" + filename );

	return { path: dest_path, name: filename, full_filename };
};

export const upload_info = ( req: ILRequest, field_name?: string, file?: any ): UploadInfo => {
	if ( !req.files ) return null;

	if ( field_name ) file = req.files[ field_name ];
	if ( !file ) return null;

	let ext = file.name.split( "." ).slice( -1 )[ 0 ];

	if ( ext == 'blob' ) ext = mime.extension( file.mimetype );

	return {
		path: file.path,
		size: file.size,
		type: mime.lookup( file.name ) as string || file.mimetype,
		name: file.name,
		ext,
		md5: file.md5,  // fileUpload
		file: file
	};
};