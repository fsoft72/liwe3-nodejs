import { config_load } from './liwe';

import * as fs from 'fs';
import * as express from 'express';
import * as HTTP from 'http';
import * as HandleBars from 'handlebars';
import * as jwt from 'jsonwebtoken';

import { LCback, ILRequest, ILResponse, ILiweConfig } from './types';

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

// import fetch from 'node-fetch';

/**
 * Checks the validity of a reCAPTCHA response.
 * @param captcha The reCAPTCHA response string.
 * @returns A Promise that resolves to the reCAPTCHA verification result.
 */
export const recaptcha_check = async ( captcha: string ) => {
	const body = `response=${ captcha }&secret=${ cfg.user.recaptcha.secret }`;

	console.log( "--- BODY: ", body );

	const data = await fetch(
		'https://hcaptcha.com/siteverify',
		{
			headers: {
				"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
			},
			body,
			method: "POST",
		}
	);

	const json = await data.json();

	console.log( "==== RECAPTCHA: ", json );

	return json;
};


/**
 * This function converts ``txt`` into an MD5 string.
 * If ``do_check`` is true, the original string is checked against a Regular Expression to
 * verify if it is already an MD5 string, and (in that case) it is just returned without hashing.
 *
 * @param txt The string to hash
 * @param do_check If T the string is checked against a Regular Expression to see if it looks like an MD5 Hash
 */
export const md5 = ( txt: string, do_check: boolean = true ) => {
	if ( !txt || txt?.length == 0 ) return '';

	const crypto = require( 'crypto' );

	if ( do_check && /^[a-z0-9]{32}$/.test( txt ) ) return txt;
	return crypto.createHash( 'md5' ).update( txt ).digest( 'hex' );
};

/**
 * Calculates the MD5 hash of a file.
 *
 * @param fname - The path to the file.
 * @returns The MD5 hash of the file.
 */
export const md5File = ( fname: string ): string => {
	const data = fs.readFileSync( fname );
	const fileContent = data.toString();
	const md5Hash = md5( fileContent );

	return md5Hash;
};

/**
 * Calculates the SHA512 hash of a given string.
 *
 * @param txt - The string to be hashed.
 * @param do_check - Optional. Specifies whether to check if the input string is already a valid SHA512 hash. Default is true.
 * @returns The SHA512 hash of the input string.
 */
export const sha512 = ( txt: string, do_check: boolean = true ) => {
	if ( !txt || txt?.length == 0 ) return '';

	const crypto = require( 'crypto' );

	if ( do_check && /^[a-z0-9]{128}$/.test( txt ) ) return txt;
	return crypto.createHash( 'sha512' ).update( txt ).digest( 'hex' );
};

/**
 * This function returns an error to Express
 *
 * @param req	The Express Request
 * @param error an Error structure
 * @param error_code the numeric error code
 *
 */
export const send_error = ( res: express.Response, error: any, error_code: number = 400 ) => {
	if ( res.headersSent ) return;

	if ( !error ) error = {};

	const err = { error_message: error, error_code: error_code };

	if ( error.message ) err.error_message = error.message;
	if ( error.code ) {
		err.error_code = error.code;
		error_code = error.code;
	}

	const e = { error: { message: err.error_message, code: err.error_code } };
	console.log( e );

	res.status( error_code ).send( { error: { message: err.error_message, code: err.error_code } } );
};

/**
 * This function is used when an Express request succedees
 *
 * @param res the express.Response
 * @param payload the reply payload that will be confìverted in JSON
 * @param status_code the return status code
 *
 */
export const send_ok = ( res: express.Response, payload: any, status_code: number = 200 ) => {
	if ( cfg.features.trace_ok ) {
		console.log( "%s\n==============================================================================\n\n", JSON.stringify( payload, null, 4 ) );
	}

	res.status( status_code ).json( payload );
};

/**
 * This function returns a simple HTML instead of the standard JSON returned by send_ok()
 *
 * @param res the express Response
 * @param payload the HTML to return
 * @param status_code the return status code
 */
export const send_html = ( res: express.Response, payload: string, status_code: number = 200 ) => {
	res.set( 'Content-Type', 'text/html' );
	res.status( status_code ).send( payload );
};

/**
 * Sends a binary response with the specified buffer, content type, and filename.
 * @param res - The express response object.
 * @param buffer - The binary buffer to send.
 * @param content_type - The content type of the response.
 * @param filename - The filename for the attachment.
 */
export const send_binary = ( res: express.Response, buffer: any, content_type: string, filename: string ) => {
	res.set( 'Content-Type', content_type );
	res.set( 'Content-Disposition', `attachment; filename=${ filename }` );
	res.status( 200 ).end( Buffer.from( buffer ) );
};

/**
 *  Generates a random integer number from `min` to `max`
 *
 * @param min Random int starting number
 * @param max Random int max ending number
 * @returns an integer between the specified min / max range
 */
export const rand_int = ( min: number = 0, max: number = 100 ): number => {
	min = Math.ceil( min );
	max = Math.floor( max );

	return Math.floor( Math.random() * ( max - min + 1 ) ) + min;
};

/**
 * Generates an unique string code (up to 37 chars long)
 *
 * @param simple	If the code should be simpler (smaller)
 * @param prefix	The prefix to add to the string
 * @param second_slice	If a second slice of random string should be added
 * @returns the unique string generated
 */
export const unique_code = ( simple: boolean = true, prefix: string = null, second_slice: boolean = true ): string => {
	const now = new Date();
	const n = now.getTime(); //  + now.getMilliseconds();

	if ( prefix )
		prefix = `${ prefix }.`;
	else
		prefix = '';

	let c = `${ prefix }${ md5( n.toString( 36 ) ) }`;

	if ( simple && !second_slice ) return c;

	c = `${ c }.${ rand_int( 0, n ).toString( 36 ).slice( 0, 4 ) }`;

	if ( simple ) return c;

	return `${ prefix }${ md5( c ) }.${ rand_int( 0, n ).toString( 36 ).slice( 0, 4 ) }`;
};

/**
 * Generates a unique code number string based on the current timestamp.
 *
 * @param {number} length - The length of the code number string to generate.
 * @param {number} [second_slice=0] - The length of the second slice to append to the code number string.
 * @returns {string} - The unique code number string.
 */
export const unique_code_numbers = ( length: number, second_slice: number = 0 ): string => {
	const now = new Date();
	const n = now.getTime().toString() + now.getMilliseconds().toString();

	// get the latest length digits of the string
	let c = n.slice( -length );

	if ( !second_slice ) return c;

	const m = now.getTime().toString() + now.getMilliseconds().toString();

	// get the latest length digits of the string
	return `${ c }.${ m.slice( -second_slice ) }`;
};

/**
 * @description This function returns an unique id, the id starts with the prefix and can optionally contain an extension
 * @param prefix - The prefix to add to the string
 * @param ext - The extension to add to the string
 */
export const mkid = ( prefix: string, ext?: string ) => {
	if ( !ext ) ext = '';
	if ( ext && ext.length && !ext.startsWith( '.' ) ) ext = `.${ ext }`;

	return `${ unique_code( false, prefix ) }${ ext }`;
};

/**
 * returns a random string of specified ``length`` using a randomizer of ``iterations``.
 *
 * @param length:  the length of the random string
 * @param iterations: the number of iterations for the random string
 * @returns the created random string
 */
export const random_string = ( length: number = 4, iterations: number = 20, numeric: boolean = false ): string => {
	const res: string[] = [];
	const FROM = numeric ? 48 : 41;
	const TO = numeric ? 57 : 122;

	if ( length > iterations )
		iterations = length + 1;

	while ( res.length < iterations ) {
		res.push( String.fromCharCode( rand_int( FROM, TO ) ) );
	}

	if ( numeric )
		return res.join( '' ).slice( -length );

	return sha512( res.join( '' ) ).slice( -length );

};

/**
 * Fetch a file from the given `url` into `dest_local_path`
 *
 * @param url   The complete URL to fetch the resource from
 * @param dest_local_path The destination local path
 */
export const fetch_file = ( url: string, dest_local_path: string ) => {
	const request = require( "request" );

	request( url ).pipe( fs.createWriteStream( dest_local_path ) );
};

/**
 * Generates a JWT token with the provided payload, secret, and expiration time.
 * @param payload - The data to be included in the token.
 * @param secret - The secret key used to sign the token.
 * @param expires - The expiration time for the token in seconds.
 * @returns The generated JWT token.
 */
export const jwt_crypt = ( payload: any, secret: string, expires: number ): string => {
	return jwt.sign( { payload }, secret, { expiresIn: expires } );
};

/**
 * Decrypts a JWT token using the provided secret.
 * @param tok - The JWT token to decrypt.
 * @param secret - The secret used to decrypt the JWT token.
 * @returns The decrypted payload if the token is valid, otherwise null.
 */
export const jwt_decrypt = ( tok: string, secret: string ): any => {
	try {
		const payload: any = jwt.verify( tok, secret );
		return payload.payload;
	} catch ( e ) {
		return null;
	}
};

/**
 * Deletes a folder and all its contents recursively.
 * @param path - The path of the folder to delete.
 */
export const delete_folder = ( path: string ): void => {
	if ( !fs.existsSync( path ) ) return;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	fs.readdirSync( path ).forEach( ( file, index ) => {
		const full_path = path + "/" + file;

		if ( fs.lstatSync( full_path ).isDirectory() ) { // recurse
			delete_folder( full_path );
		} else { // delete file
			fs.unlinkSync( full_path );
		}
	} );

	fs.rmdirSync( path );
};

/**
 * Executes a shell command asynchronously.
 * @param command - The shell command to execute.
 * @param cback - Optional callback function to handle the result or error.
 * @returns A promise that resolves with the result of the command or rejects with an error.
 */
export const shell = async ( command: string, cback: any ) => {
	const exec = require( 'child_process' ).exec;

	return new Promise( ( resolve, reject ) => {
		const res = { stdout: '', stderr: '' };

		console.log( "SHELL: ", command );

		exec( command, ( error: any, stdout: any, stderr: any ) => {
			res.stdout = stdout;
			res.stderr = stderr;

			if ( error ) {
				return cback ? cback( error ) : reject( error );
			}

			return cback ? cback( null, res ) : resolve( res );
		} );
	} );
};

/**
 * Download the file specified by the given ``url`` using progressive events
 *
 * The function gets 3 cbacks:
 *
 * - update_cback ( chunk, perc, size, total )
 *
 *      - chunk:  the chunk to write     ( eg. fs.syncWrite ( fd, chunk, 0, chunk.len ) );
 *      - perc:   the percentual of the file downloaded (float)
 *      - size:   the size (in MB) of the file downloaded
 *      - total:  total size in MB
 *
 * - end_cback ()
 *
 *   This cback is called at the end of the download
 *
 * - err_cback ( err )
 *
 *   This cback is called when something goes wrong
 */
export const progressive_fetch_file = ( url: string, update_cback: any, end_cback: any, err_cback: any ) => {
	const http = url.indexOf( "https" ) === - 1 ? require( "http" ) : require( "https" );

	const MB1 = 1048576;  // bytes in megabyte

	const request = http.get( url, ( response: HTTP.IncomingMessage ) => {
		const len = parseInt( response.headers[ 'content-length' ] || "0", 10 );
		let cur = 0;
		const total = len / MB1;

		response.on( "data", ( chunk ) => {
			cur += chunk.length;

			const perc = ( 100.0 * cur / len );
			const size = ( cur / MB1 );

			if ( update_cback ) update_cback( chunk, perc, size, total );
		} );

		response.on( "end", () => {
			if ( end_cback ) end_cback();
		} );

		request.on( "error", ( e: any ) => {
			if ( err_cback ) err_cback( e );
		} );
	} );
};

/**
 * Renders a template file with Handlebars syntax
 *
 *
 * @param {str} template_full_path - Full path for the file containing the template
 * @param {object} dct  - An object with all key / values needed
 */
export const template_render = ( template_full_path: string, dct: object ): string => {
	let tmpl: string;

	try {
		tmpl = fs.readFileSync( template_full_path ).toString();
	} catch ( e ) {
		return `ERROR: template not found ${ template_full_path }`;
	}

	const f: HandleBars.TemplateDelegate = HandleBars.compile( tmpl );

	return f( dct );
};

export interface IFieldDescr {
	name: string;
	type: string | object;
	default?: any;
	required?: boolean;
}

/**
 * Converts a dictionary object into a typed object based on the provided field descriptions.
 * @param dct The dictionary object to convert.
 * @param fields_descr The array of field descriptions.
 * @returns The typed object with converted values and error information.
 */
export const typed_dict = ( dct: any, fields_descr: IFieldDescr[] ) => {
	const res: any = { ___errors: [] };

	fields_descr.map( async ( field ) => {
		let v = dct[ field.name ];
		let type: any;
		let chk;

		if ( isObject( field.type ) )
			type = field.type;
		else
			type = ( field.type as string ).toLowerCase();

		if ( v === undefined || v === null || v === 'null' || v === 'undefined' )
			v = field.default;

		if ( v === undefined && field.required ) {
			res.___errors.push( field.name );
			console.error( "ERROR: missing field: ", field.name );
		}

		// This is to handle JSON inside multipart-forms
		try {
			v = JSON.parse( v );
		} catch ( e ) { }

		if ( v !== undefined ) {
			if ( isObject( type ) ) {
				v = v.toString();
				const vals = Object.values( type );

				if ( vals.indexOf( v ) == -1 ) {
					res.___errors.push( `Invalid value for '${ field.name }' [${ ( type as any ).__name }]: ${ v }` );
					v = undefined;
				}
			} else {
				switch ( type ) {
					case "str":
					case "string":
						v = v.toString();
						break;

					case "int":
					case "integer":
						v = int( v );
						break;

					case "float":
					case "number":
						v = float( v );
						break;

					case "bool":
					case "boolean":
						v = v.toString();
						if ( v === "true" || v === "True" || v === "1" )
							v = true;
						else if ( v === 'false' || v === 'False' || v === '0' )
							v = false;
						else
							v = undefined;
						break;

					case "date":
						v = new Date( v );
						if ( !isValidDate( v ) ) v = new Date();
						break;

					case "recaptcha":
						chk = await recaptcha_check( v );
						break;
				}
			}
		}

		res[ field.name ] = v;
	} );

	return res;
};

const _formatDatetime = ( date: Date, format: string ) => {
	const _padStart = ( value: number ): string => value.toString().padStart( 2, '0' );
	return format.replace( /yyyy/g, _padStart( date.getFullYear() ) )
		.replace( /dd/g, _padStart( date.getDate() ) )
		.replace( /mm/g, _padStart( date.getMonth() + 1 ) )
		.replace( /HH/g, _padStart( date.getHours() ) )
		.replace( /MM/g, _padStart( date.getMinutes() ) )
		.replace( /SS/g, _padStart( date.getSeconds() ) )
		;
};

/**
 * Checks if a given date is valid.
 * @param d - The date to be checked.
 * @returns A boolean indicating whether the date is valid or not.
 */
const isValidDate = ( d: Date ): boolean => !isNaN( d.getTime() );

/**
 *  converts a date into a string with the desired format
 *
 *  yyyy - year
 *   mm  - month
 *   dd  - day
 *
 *   HH - hour
 *   MM - minutes
 *   SS - seconds
 */
export const date_format = ( date: any, format = 'yyyy-mm-dd HH:MM:SS' ): string => {
	const datetime = new Date( date );

	return isValidDate( datetime ) ? _formatDatetime( datetime, format ) : '';
};

/**
 * Checks if the given email is valid.
 *
 * @param email - The email to be validated.
 * @returns True if the email is valid, false otherwise.
 */
export const isValidEmail = ( email: string ): boolean => {
	if ( !email || !email.length ) return false;
	return !!email.match( /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/ );
};

/*
export const isValidDate = ( d: any ) => {
	return d instanceof Date && !isNaN( d );
};
*/

/**
 * Converts the input value to an integer.
 * If the input value is falsy or undefined, returns 0.
 * @param s - The value to convert to an integer.
 * @returns The converted integer value.
 */
export const int = ( s: any ): number => {
	if ( !s ) return 0;
	if ( typeof ( s ) === 'undefined' ) s = "0";
	return parseInt( s.toString(), 10 );
};

/**
 * Converts a value to a floating-point number.
 * If the value is falsy, returns 0.0.
 * @param s - The value to convert.
 * @returns The converted floating-point number.
 */
export const float = ( s: any ): number => {
	if ( !s ) return 0.0;
	return parseFloat( s.toString() );
};

/**
 * remove keys specified by `keys` in `obj`
 * This is a 'change in place' function.
 * The object is modified in memory
 */
export const keys_remove = ( obj: any, keys: string[] ) => {
	if ( !obj ) return;

	keys.map( ( k ) => {
		delete obj[ k ];
	} );
};

/**
 * sets an attribute to `obj` only if `val` is not undefined.
 */
export const set_attr = ( obj: any, field_name: string, val: any ) => {
	if ( val === undefined ) return;

	obj[ field_name ] = val;
};

/**
 * sets multiple attributes to  `obj` only if `val` is not undefined.
 */
export const set_attrs = ( obj: any, data: any ) => {
	Object.keys( data ).forEach( ( k: string ) => {
		const v = data[ k ];

		if ( v === undefined ) return;

		obj[ k ] = v;
	} );

	return obj;
};

/**
 * Filters the keys of an object `obj` based on the
 * specified fields in `type_def`.
 * If a key is not in `type_def`, it is removed from `obj`.
 */
export const keys_filter = ( obj: any, type_def: any ) => {
	if ( !obj ) return;

	Object.keys( obj ).forEach( ( k ) => {
		// if the key is not in the type definition, remove it
		const el = type_def[ k ];
		if ( !el ) {
			delete obj[ k ];
			return;
		}

		// if the key is private, remove it
		if ( el.priv === true ) {
			delete obj[ k ];
			return;
		}


		// If we expect a string, but the result is an array
		// we keep only the first element
		if ( el.type == 'string' && Array.isArray( obj[ k ] ) ) {
			if ( obj[ k ].length === 0 ) {
				obj[ k ] = '';
			} else {
				obj[ k ] = obj[ k ][ 0 ];
			}
		}
	} );
};

/**
 * Returns a date in international format 'YYYY-MM-DD'
 */
export const get_date = ( d: Date ): string => {
	let year = d.getFullYear();
	let month: any = d.getMonth() + 1;
	let day = d.getDate();

	if ( month < 10 ) month = `0${ month }`;
	return `${ year }-${ month }-${ day }`;
};

/**
 * adds a new element (el) to a string list (lst)
 * only if `el` does not exists in `lst`
 *
 * @param lst	the string list to add the element to
 * @param el	element to be added
 *
 * @returns the new modified list
 */
export const list_add = ( lst: string[], el: string ) => {
	if ( !lst ) lst = [];

	el = el.toLowerCase();
	if ( lst.indexOf( el ) != -1 ) return lst;

	lst.push( el );

	return lst;
};

/**
 * removes an element (el) from the list (lst)
 *
 * @param lst	the string list to add the element to
 * @param el	element to be added
 *
 * @returns  the new modified list
 */
export const list_del = ( lst: string[], el: string ) => {
	if ( !lst ) return [];

	el = el.toLowerCase();
	lst = lst.filter( ( m ) => m != el );

	return lst;
};

/**
 * returns a new object with only the keys that are not undefined
 *
 * @param dct	the object with keys that can be undefined
 *
 * @returns a new object with valid keys
 */
export const keys_valid = ( dct: any ) => {
	const res: any = {};
	Object.keys( dct ).forEach( ( k ) => {
		if ( dct[ k ] === undefined ) return;

		res[ k ] = dct[ k ];
	} );

	return res;
};

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject ( item: any ) {
	return ( item && typeof item === 'object' && !Array.isArray( item ) );
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function merge ( target: any, ...sources: any[] ): any {
	if ( !sources.length ) return target;
	const source = sources.shift();

	if ( isObject( target ) && isObject( source ) ) {
		for ( const key in source ) {
			if ( isObject( source[ key ] ) ) {
				if ( !target[ key ] ) Object.assign( target, { [ key ]: {} } );
				merge( target[ key ], source[ key ] );
			} else {
				Object.assign( target, { [ key ]: source[ key ] } );
			}
		}
	}

	return merge( target, ...sources );
}

/**
 * Picks a random element from the given list.
 * @param lst - The list to pick from.
 * @returns The randomly picked element from the list.
 */
export const list_random_pick = ( lst: any[] ) => {
	if ( !lst ) return '';

	return lst[ Math.floor( Math.random() * lst.length ) ];
};

/**
 * Picks n random elements from the given list.
 *
 * @param lst - The list from which to pick random elements.
 * @param n - The number of random elements to pick.
 * @returns An array containing n random elements from the list.
 */
export const list_random_pick_n = ( lst: any[], n: number ) => {
	if ( !lst ) return [];

	const res: any[] = [];
	for ( let i = 0; i < n; i++ ) {
		res.push( list_random_pick( lst ) );
	}

	return res;
};


/**
 * takes a list of strings and returns a valid challenge
 */
export const challenge_create = ( params: string[], debug = false ) => {
	const s: string[] = params.map( ( p ) => ( p || '' )?.toString().toLowerCase() );
	s.sort();
	s.push( cfg.security.remote );

	let ckey = s.join( '-' );

	// remove multiple '-' characters
	ckey = ckey.replace( /-{2,}/g, '-' );

	// remove all starting '-' characters
	while ( ckey[ 0 ] == '-' ) ckey = ckey.substring( 1 );

	/*
	if ( cfg.debug.enabled || debug )
		console.log( "=== Server Challenge: ", ckey );
	*/

	return md5( ckey );
};

/**
 * takes a list of strings and check it agains the provided challenge
 *
 * @param challenge	the challenge to check
 * @param params	the list of strings to check
 *
 * @returns true if the challenge is valid
 */
export const challenge_check = ( challenge: string, params: string[] ): boolean => {
	if ( cfg.debug.enabled && challenge == cfg.debug.challenge ) return true;

	const ch = challenge_create( params );

	// console.log( "SENT MD5: %s - VALID: %s", challenge, ch );
	return ch === challenge;
};

/**
 * Converts a string into a slug by removing special characters, converting to lowercase, and replacing spaces with dashes.
 * @param str - The string to be slugified.
 * @returns The slugified string.
 */
export const slugify = ( str: string ) => {
	str = str.replace( /^\s+|\s+$/g, '' ); // trim
	str = str.toLowerCase();

	// list of characters group to be replaced
	const groups = [
		{ from: '[àáäâãåÀÁÄÂÃÅ]', to: 'a' },
		{ from: '[èéëêÈÉËÊ]', to: 'e' },
		{ from: '[ìíïîÌÍÏÎ]', to: 'i' },
		{ from: '[òóöôõøÒÓÖÔÕØ]', to: 'o' },
		{ from: '[ùúüûÙÚÜÛ]', to: 'u' },
		{ from: '[ñÑ]', to: 'n' },
		{ from: 'ç', to: 'c' },
		{ from: 'ß', to: 'ss' },
		// invalid chars
		{ from: '[^a-z0-9 -]', to: '' },
		// collapse whitespace and replace by -
		{ from: '\\s+', to: '-' },
		// collapse dashes
		{ from: '-+', to: '-' },
	];

	groups.forEach( ( g ) => {
		str = str.replace( new RegExp( g.from, 'g' ), g.to );
	} );

	return str;
};

const dec2base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/**
 * Converts a decimal number to a base-96 string representation.
 * @param decimal The decimal number to convert.
 * @returns The base-96 string representation of the decimal number.
 */
export const decimalToBase96 = ( decimal: number ): string => {
	let result = "";
	while ( decimal > 0 ) {
		const remainder = decimal % 96;
		result += dec2base64_chars.charAt( remainder );
		decimal = Math.floor( decimal / 96 );
	}
	return result.split( "" ).reverse().join( "" );
};

/**
 * Converts a base96 number to decimal.
 *
 * @param base96 - The base96 number to convert.
 * @returns The decimal representation of the base96 number.
 */
export const base96ToDecimal = ( base96: string ): number => {
	let decimal = 0;
	for ( let i = base96.length - 1; i >= 0; i-- ) {
		const char = base96.charAt( i );
		const power = base96.length - 1 - i;
		const value = dec2base64_chars.indexOf( char );
		decimal += value * Math.pow( 96, power );
	}
	return decimal;
};

/**
 * Formats a number as a currency string.
 * @param number - The number to format.
 * @param options - Optional formatting options.
 * @param options.thousandSeparator - The character used as a thousand separator. Default is '.'.
 * @param options.decimalSeparator - The character used as a decimal separator. Default is ','.
 * @returns The formatted currency string.
 */
export const formatCurrency = ( number: number, { thousandSeparator = '.', decimalSeparator = ',' } = {} ): string => {
	// if number is a string, convert to float
	if ( !number ) return '';
	if ( typeof number === 'string' ) {
		number = parseFloat( number );
	}

	let buffer = '';
	let parts = number.toFixed( 2 ).split( '.' );
	let integerPart = parts[ 0 ];
	let decimalPart = parts[ 1 ];

	for ( let i = 0; i < integerPart.length; i++ ) {
		if ( i > 0 && ( integerPart.length - i ) % 3 === 0 ) {
			buffer += thousandSeparator;
		}
		buffer += integerPart[ i ];
	}

	buffer += decimalSeparator;
	buffer += decimalPart;

	return buffer;
};

/// export a number with a fixed number of decimals
export const toNumDecimal = ( num: number, dec: number ): number => {
	const s = ( num ?? 0 ).toString();
	const n = parseFloat( s ).toFixed( dec );

	return parseFloat( n );
};