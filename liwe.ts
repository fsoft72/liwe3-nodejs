import { error, warn } from './console_colors';
import * as fs from './fs';
import { ILiweConfig } from './types';

/**
 * Returns the absolute path of a file or directory.
 *
 * @param {string} path - The path to the file or directory.
 * @returns {string} The absolute path of the file or directory.
 */
export const fsname = ( path: string ): string => {
	if ( !path.startsWith( '.' ) ) return fs.abspath( './' + path );

	return fs.abspath( path );
};

/**
 * Returns the full path of a configuration file.
 * @param fname The name of the configuration file.
 * @returns The full path of the configuration file.
 */
export const config_fullpath = ( fname: string = '' ): string => fsname( `etc/config/${ fname }` );

/**
 * Returns the full path of a template file.
 *
 * @param modname - The name of the module.
 * @param fname - The name of the template file (optional).
 * @returns The full path of the template file.
 */
export const template_fullpath = ( modname: string, fname: string = '' ): string => fsname( `etc/templates/${ modname }/${ fname }` );

/**
 * Returns the full path for uploading files.
 *
 * @param subpath - The subpath to append to the upload directory.
 * @returns The full path for uploading files.
 */
export const upload_fullpath = ( subpath: string = '' ): string => fsname( `static/public/uploads/${ subpath }` );

/**
 * Returns the full path for a public file or directory.
 *
 * @param subpath - The subpath within the "static/public" directory.
 * @returns The full path for the public file or directory.
 */
export const public_fullpath = ( subpath: string = '' ): string => fsname( `static/public/${ subpath }` );

/**
 * Returns the full path for a temporary file or directory.
 *
 * @param subpath - The subpath within the temporary directory.
 * @returns The full path for the temporary file or directory.
 */
export const temp_fullpath = ( subpath: string = '' ): string => fsname( `static/temp/${ subpath }` );

/**
 * Returns the full path of the server file.
 * @param subpath - The subpath of the server file.
 * @returns The full path of the server file.
 */
export const server_fullpath = ( subpath: string = '' ): string => fsname( `dist/server/${ subpath }` );

/**
 * Returns the full path of a module.
 * @param subpath The subpath of the module.
 * @returns The full path of the module.
 */
export const module_fullpath = ( subpath: string = '' ): string => fsname( `dist/server/modules/${ subpath }` );

/**
 * Returns the relative path of a given full path.
 *
 * @param fullpath - The full path to convert to a relative path.
 * @returns The relative path.
 */
export const relative_fullpath = ( fullpath: string = '' ): string => {
	const fsn = fsname( '.' );
	const x = fullpath.indexOf( fsn );

	if ( x == -1 ) return fullpath;

	return fullpath.slice( fsn.length );
};

/**
 * Extracts the relative path from a full path by removing the "/static/public" prefix.
 * @param full_path The full path to extract the relative path from.
 * @returns The relative path.
 */
export const public_relative_path = ( full_path: string = '' ): string => full_path.split( "/static/public" ).slice( -1 )[ 0 ];

/**
 * Loads a configuration file from the specified path.
 *
 * @param {string} [fname=''] - The name of the configuration file to load.
 * @param {*} [_default={}] - The default value to return if the configuration file is not found.
 * @param {boolean} [show_error=false] - Whether to log an error message to the console if the configuration file is not found.
 * @param {boolean} [raise_exception=false] - Whether to throw an exception if the configuration file is not found.
 * @param {string} [path='etc/config'] - The path to the directory containing the configuration files.
 * @returns {*} The parsed configuration object.
 */
export const config_load = ( fname: string = '', _default: any = {}, show_error: boolean = false, raise_exception: boolean = false, path: string = 'etc/config' ): any => {
	let name = fsname( `${ path }/${ fname }.json` );

	if ( !fs.exists( name ) ) name = fsname( `${ path }/${ fname }.js` );

	if ( !fs.exists( name ) ) {
		if ( show_error ) error( 'ERROR: config not found: ', name );

		if ( raise_exception ) throw new Error( 'ERROR: config not found: ' + name );

		return _default;
	}

	let cfg = fs.read( name );
	// get current working directory
	const cwd = fsname( '.' );

	// replace all '$SERVER' entries with current working directory in cfg
	cfg = cfg.replace( /\$SERVER/g, cwd );

	return JSON.parse( cfg );
};

/**
 * Loads the configuration for a module.
 *
 * @param modname - The name of the module.
 * @param _default - The default configuration to use if the module configuration is not found.
 * @param show_error - Whether to show an error message if the module configuration is not found.
 * @param raise_exception - Whether to raise an exception if the module configuration is not found.
 * @returns The configuration object for the module.
 */
export const module_config_load = ( modname: string, _default: any = {}, show_error: boolean = false, raise_exception: boolean = false ): any => {
	return config_load( modname, _default, show_error, raise_exception, 'etc/config/modules' );
};

/**
 * Creates the default directories if they do not exist.
 * @param fullpath - The full path of the directory.
 */
export const make_default_dirs = ( fullpath: string ): void => {
	if ( !fs.exists( fullpath ) ) fs.mkdir( fullpath, 0o755, true );
};

/**
 * Loads a callback function from a module.
 * @param modulename - The name of the module.
 * @param cback_name - The name of the callback function.
 * @param default_cback - The default callback function to use if the specified callback is not found.
 * @param report_errors - Indicates whether to report errors or not. Default is true.
 * @returns The loaded callback function or the default callback function if not found.
 */
export const callback_load = ( modulename: string, cback_name: string, default_cback: any, report_errors: boolean = true ) => {
	const fname = fsname( `etc/callbacks/${ modulename }.js` );

	if ( !fs.exists( fname ) ) {
		if ( report_errors ) console.warn( `WARN: missing callbacks for: ${ modulename } (${ fname })` );
		return default_cback;
	}

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const mod = require( fname );
	const fn = mod[ cback_name ];

	if ( !fn ) {
		if ( report_errors ) console.warn( `WARN: callback ${ cback_name } not found for module ${ modulename }` );
		return default_cback;
	}

	return fn;
};

/**
 * Utility functions for string validation, checking emptiness, and key existence in objects.
 */
export const $l = {
	/**
	 * Checks if a given value is a valid string.
	 * @param t - The value to be checked.
	 * @returns True if the value is a non-empty string, false otherwise.
	 */
	str_valid: ( t: string ): boolean => {
		if ( typeof t !== 'string' ) return false;
		if ( !t || !t.length ) return false;
		return true;
	},

	/**
	 * Checks if a given value is empty.
	 * @param t - The value to be checked.
	 * @returns True if the value is an empty object or an empty string, false otherwise.
	 */
	is_empty: ( t: any ): boolean => {
		if ( typeof t === 'object' ) return Object.keys( t ).length === 0;
		if ( typeof t === 'string' ) return t.length === 0;
		return false;
	},

	/**
	 * Checks if a given object has a specific key.
	 * @param t - The object to be checked.
	 * @param key - The key to be checked.
	 * @returns True if the object has the specified key, false otherwise.
	 */
	has_key: ( t: any, key: string ): boolean => {
		return Object.keys( t ).indexOf( key ) !== -1;
	}
};