import { mkid } from "./arangodb";
import { mkdir, move } from "./fs";
import { ILRequest } from "./types";

export const upload_move = ( req: ILRequest, field_name: string, dest_path: string, dest_fname?: string ) => {
	const finfo = upload_info( req, field_name );

	if ( !finfo.size ) return {};

	mkdir( dest_path );

	if ( !dest_fname ) dest_fname = mkid( 'file' ) + "." + finfo.ext;
	const full_filename = dest_path + "/" + dest_fname;

	move( finfo.path, dest_path + "/" + dest_fname );

	return { path: dest_path, name: dest_fname, full_filename };
};

export const upload_info = ( req: ILRequest, field_name: string ) => {
	if ( !req.files ) return {};

	const file: any = req.files[ field_name ];

	if ( !file ) return {};

	return {
		path: file.path,
		size: file.size,
		type: file.type,
		name: file.name,
		ext: file.name.split( "." ).slice( -1 )
	};
};