import * as fs from './fs';

export const fsname = ( path: string ): string => {
	if ( !path.startsWith( '.' ) ) return fs.abspath( './' + path );

	return fs.abspath( path );
};

export const config_fullpath = ( fname: string = '' ): string => fsname( `etc/config/${ fname }` );
export const template_fullpath = ( modname: string, fname: string = '' ): string => fsname( `etc/templates/${ modname }/${ fname }` );
export const upload_fullpath = ( subpath: string = '' ): string => fsname( `static/public/uploads/${ subpath }` );
export const public_fullpath = ( subpath: string = '' ): string => fsname( `static/public/${ subpath }` );
export const temp_fullpath = ( subpath: string = '' ): string => fsname( `static/temp/${ subpath }` );
export const server_fullpath = ( subpath: string = '' ): string => fsname( `dist/server/${ subpath }` );
export const module_fullpath = ( subpath: string = '' ): string => fsname( `dist/server/modules/${ subpath }` );
export const relative_fullpath = ( fullpath: string = '' ): string => {
	const fsn = fsname( '.' );
	const x = fullpath.indexOf( fsn );

	if ( x == -1 ) return fullpath;

	return fullpath.slice( fsn.length );
};

export const public_relative_path = ( full_path: string = '' ): string => full_path.split( "/static/public" ).slice( -1 )[ 0 ];

export const config_load = ( fname: string = '', _default: any = {}, show_error: boolean = false, raise_exception: boolean = false, path: string = 'etc/config' ): any => {
	let name = fsname( `${ path }/${ fname }.json` );

	if ( !fs.exists( name ) ) name = fsname( `${ path }/${ fname }.js` );

	if ( !fs.exists( name ) ) {
		if ( show_error ) console.error( 'ERROR: config not found: ', name );

		if ( raise_exception ) throw new Error( 'ERROR: config not found: ' + name );

		return _default;
	}

	return require( name );
};

export const make_default_dirs = ( fullpath: string ): void => {
	if ( !fs.exists( fullpath ) ) fs.mkdir( fullpath, 0o755, true );
};

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

export const $l = {
	str_valid: ( t: string ): boolean => {
		if ( typeof t !== 'string' ) return false;
		if ( !t || !t.length ) return false;

		return true;
	},

	is_empty: ( t: any ): boolean => {
		if ( typeof t === 'object' ) return Object.keys( t ).length === 0;

		if ( typeof t === 'string' ) return t.length === 0;

		return false;
	},

	has_key: ( t: any, key: string ): boolean => {
		// console.log("KEYS: ", Object.keys(t));
		return Object.keys( t ).indexOf( key ) !== -1;
	}
};
