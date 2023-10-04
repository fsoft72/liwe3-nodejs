import * as fs from 'fs';
import * as path from 'path';
// import { unique_code } from './utils';

/**
 * Deletes a file if it exists.
 *
 * @param {string} path - The path to the file to delete.
 * @returns {void}
 */
export const unlink = ( path: string ): void => {
	if ( fs.existsSync( path ) ) fs.unlinkSync( path );
};

/**
 * Checks if a file or directory exists.
 *
 * @param {string} path - The path to the file or directory to check.
 * @returns {boolean} `true` if the file or directory exists, `false` otherwise.
 */
export const exists = ( path: string ): boolean => {
	return fs.existsSync( path );
};

/**
 * Checks if a path is a file.
 *
 * @param path the path to check
 * @returns true if the path is a file
 */
export const isFile = ( path: string ): boolean => {
	try {
		return fs.statSync( path ).isFile();
	} catch ( e ) {
		return false;
	}
};

/**
 * Checks if a path is a directory.
 *
 * @param path the path to check
 * @returns true if the path is a directory
 */
export const isDirectory = ( path: string ): boolean => {
	try {
		return fs.statSync( path ).isDirectory();
	} catch ( e ) {
		return false;
	}
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

/**
 * Deletes a directory if it exists.
 *
 * @param {string} dirname - The path to the directory to delete.
 * @returns {void}
 */
export const rmdir = ( dirname: string ) => {
	if ( exists( dirname ) ) fs.rmdirSync( dirname );
};

/**
 * Deletes a file if it exists.
 *
 * @param {string} fname - The path to the file to delete.
 * @returns {void}
 */
export const rm = ( fname: string ) => {
	if ( exists( fname ) ) fs.unlinkSync( fname );
};

/**
 * Reads the contents of a directory.
 *
 * @param {string} dirname - The path to the directory to read.
 * @returns {string[]} An array of filenames in the directory.
 */
export const readdir = ( dirname: string ): string[] => {
	if ( !exists( dirname ) ) return [];

	return fs.readdirSync( dirname );
};

/**
 * Reads the contents of a file.
 *
 * @param {string} fname - The path to the file to read.
 * @returns {string} The contents of the file as a string.
 */
export const read = ( fname: string ): string => {
	if ( !exists( fname ) ) return '';

	return fs.readFileSync( fname, { encoding: 'utf8' } ).toString();
};

/**
 * Resolves a relative path to an absolute path.
 *
 * @param {string} rel_path - The relative path to resolve.
 * @returns {string} The absolute path.
 */
export const abspath = ( rel_path: string ): string => {
	return path.resolve( rel_path );
};

/**
 * Renames a file or directory.
 *
 * @param {string} old_path - The path to the file or directory to rename.
 * @param {string} new_path - The new path for the file or directory.
 * @returns {void}
 */
export const rename = ( old_path: string, new_path: string ): void => {
	return fs.renameSync( old_path, new_path );
};

/**
 * move ( old_path, new_path ) => void
 *
 * Moves a file from ``old_path`` to ``new_path``.
 *
 * This function first tries using `rename` function. If it cannot be used, then the file is copied and removed.
 *
 * @param old_path:  original file name to move
 * @param new_path:  destination file name
 *
 * @see rename
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

/**
 * Writes data to a file.
 *
 * @param {string} full_path - The path to the file to write to.
 * @param {string} data - The data to write to the file.
 * @returns {void}
 */
export const write = ( full_path: string, data: string | Buffer ): void => {
	return fs.writeFileSync( full_path, data );
};

/**
 * Gets information about a file or directory.
 *
 * @param {string} full_path - The path to the file or directory to get information about.
 * @returns {fs.Stats} An object containing information about the file or directory.
 */
export const stat = ( full_path: string ) => {
	return fs.lstatSync( full_path );
};

/**
 * Gets the base name of a file or directory path.
 *
 * @param {string} full_path - The path to the file or directory.
 * @returns {string} The base name of the file or directory.
 */
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

/**
 * Creates a symbolic link.
 *
 * @param {string} src - The path to the source file or directory.
 * @param {string} dest - The path to the destination file or directory.
 * @returns {void}
 */
export const symlink = ( src: string, dest: string ): void => {
	fs.symlinkSync( src, dest );
};

export const createWriteStream = ( path: string, options: any ) => {
	return fs.createWriteStream( path, options );
};

/**
 * Takes a filename and returns a sanitized version of it.
 * By default, it replaces all non-alphanumeric characters with underscores and converts to lowercase.
 *
 * @param {string} filename - The filename to sanitize.
 * @returns {string} The sanitized filename.
 */
export const sanitize = ( filename: string ) => {
	return filename.replace( /[^a-z0-9\./]/gi, '_' ).toLowerCase();
};

/**
 * Returns the size of a file in bytes.
 * @param path the path to the file
 * @returns the size of the file in bytes
 */
export const fileSize = ( path: string ): number => {
	const stats = stat( path );
	const fileSizeInBytes = stats.size;

	return fileSizeInBytes;
};