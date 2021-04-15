import * as fs from 'fs';
import * as path from 'path';
// import { unique_code } from './utils';

export const unlink = ( path: string ): void => {
	if ( fs.existsSync( path ) ) fs.unlinkSync( path );
};

export const exists = ( path: string ): boolean => {
	return fs.existsSync( path );
};

/**
 * mkdir - creates a new directory
 *
 * @param dirname - directory name to be created
 * @param mode - [0o755] directory mode
 * @param recursive - [true] if missing sub dirs should be created.
 */
export const mkdir = ( dirname: string, mode: number = 0o755, recursive: boolean = true ) => {
	const options = { recursive, mode };

	if ( !exists( dirname ) ) fs.mkdirSync( dirname, options );
};

export const rmdir = ( dirname: string ) => {
	if ( exists( dirname ) ) fs.rmdirSync( dirname );
};

export const rm = ( fname: string ) => {
	if ( exists( fname ) ) fs.unlinkSync( fname );
};

export const readdir = ( dirname: string ): string[] => {
	if ( !exists( dirname ) ) return [];

	return fs.readdirSync( dirname );
};

export const read = ( fname: string ): string => {
	if ( !exists( fname ) ) return '';

	return fs.readFileSync( fname, { encoding: 'utf8' } ).toString();
};

export const abspath = ( rel_path: string ): string => {
	return path.resolve( rel_path );
};

export const rename = ( old_path: string, new_path: string ): void => {
	return fs.renameSync( old_path, new_path );
};

/**
 * move ( old_path, new_path ) => void
 *
 * Moves a file from ``old_path`` to ``new_path``.
 *
 * @param old_path:  original file name to move
 * @param new_path:  destination file name
 */
export const move = ( old_path: string, new_path: string ): boolean => {
	if ( !exists( old_path ) ) return false;

	try {
		rename( old_path, new_path );
		return true;
		// eslint-disable-next-line no-empty
	} catch ( e ) { }

	// If rename() doesn't work, we are on multiple devices / disks
	fs.copyFileSync( old_path, new_path );
	rm( old_path );

	return true;
};

export const write = ( full_path: string, data: string ): void => {
	return fs.writeFileSync( full_path, data );
};

export const stat = ( full_path: string ) => {
	return fs.lstatSync( full_path );
};

export const basename = ( full_path: string ) => {
	return path.basename( full_path );
};

/**
 * @ignore
 * creates a temp file in the `full_path` given.
 * This function is sync.
 *
 * @param path the path where create the temp file
 * @param name the filename of the temp file (if not provided `unique_code()` will be used)
 * @param mode file permissions
 *
 * @returns the full_path of the created file
 */

/*
export const tmp_file = ( path: string, name: string = '', mode = 0o600 ) => {
	if ( !name ) name = unique_code();
	const full_path = `${ path }/${ name }`;
	const fd = fs.openSync( full_path, 'wb', mode );
	fs.closeSync( fd );

	return full_path;
};
*/
