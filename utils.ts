import { config_load } from './liwe';

const cfg = config_load( 'data', {}, true, true );

import * as fs from 'fs';
import * as express from 'express';
import * as HTTP from 'http';
import * as HandleBars from 'handlebars';
import * as jwt from 'jsonwebtoken';

import { LCback, ILRequest, ILResponse } from './types';

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
 * @returns the unique string generated
 */
export const unique_code = ( simple: boolean = true ): string => {
	const now = new Date();
	const n = now.getTime() + now.getMilliseconds();

	const c = `${ ( rand_int( 0, n ) + n ).toString( 36 ) }.${ rand_int( 0, n ).toString( 36 ).slice( 0, 4 ) }`;

	if ( simple ) return c;

	return `${ md5( c ) }.${ rand_int( 0, n ).toString( 36 ).slice( 0, 4 ) }`;
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
 * Decrypts a message received in the req.body field
 * and returns the message as Object
 * This function uses [[payload_decrypt]]()
 *
 * @param req   The ILRequest object
 * @returns an Object with decrypted data
 * @see [[payload_decrypt]]
 */
export const message_decrypt = ( req: ILRequest ) => {
	const { q } = req.body;
	const msg = payload_decrypt( q, req.cfg.security.secret );

	delete msg.exp;
	delete msg.iat;

	return msg;
};

/**
 * Encrypt a message and sends it back to the server with ILResponse
 *
 * @param res  the ILResponse to send the answer to
 * @param payload the object to be encrypted
 */
export const message_send_encrypted = ( res: ILResponse, payload: any ) => {
	const q = payload_crypt( payload, cfg.security.secret, 5 );
	res.send( { q } );
};

export const payload_crypt = ( payload: string, secret: string, expires: number ): string => {
	const s = jwt.sign( payload, secret, { expiresIn: expires } );

	return s;
};

export const jwt_crypt = ( payload: any, secret: string, expires: number ): string => {
	return jwt.sign( { payload }, secret, { expiresIn: expires } );
};

export const jwt_decrypt = ( tok: string, secret: string ): any => {
	try {
		const payload: any = jwt.verify( tok, secret );
		return payload.payload;
	} catch ( e ) {
		return null;
	}
};

/**
 * Decrypts a message
 *
 * @param crypted  The encrypted string to decrypt
 * @param secret   The secret salt
 */
export const payload_decrypt = ( crypted: string, secret: string ): any => {
	try {
		const payload = jwt.verify( crypted, secret );
		return payload;
	} catch ( e ) {
		return { message: 'expired' };
	}
};

export const crypt_send_message = ( url: string, payload: any, secret: string, expires: number, cback: LCback ) => {
	const axios = require( "axios" );
	const crypted = payload_crypt( payload, secret, expires );

	axios.post( url, { q: crypted } )
		.then( ( resp: any ) => {
			const res = payload_decrypt( resp.data.q, secret );
			delete res.iat;
			delete res.exp;
			return cback( null, res );
		} )

		.catch( ( err: any ) => {
			return cback( err );
		} );
};

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

export const shell = ( command: string, cback: any ) => {
	const exec = require( 'child_process' ).exec;

	exec( command, ( error: any, stdout: any, stderr: any ) => {
		console.log( "ERROR: ", error, stdout, stderr );
		if ( cback ) cback( error, stdout, stderr );
	}
	);
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
	type: string;
	default?: any;
	required?: boolean;
}

export const typed_dict = ( dct: any, fields_descr: IFieldDescr[] ) => {
	const res: any = { ___errors: [] };

	fields_descr.map( ( field ) => {
		let v = dct[ field.name ];
		const type = field.type.toLowerCase();

		if ( v === undefined || v === null )
			v = field.default;

		if ( v === undefined && field.required ) {
			res.___errors.push( field.name );
			console.error( "ERROR: missing field: ", field.name );
		}

		if ( v !== undefined ) {
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
					break;

				case "date":
					v = new Date( v );
					break;
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

export const isValidEmail = ( email: string ): boolean => {
	if ( !email || !email.length ) return false;
	return !!email.match( /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/ );
};

export const int = ( s: any ): number => {
	return parseInt( s.toString(), 10 );
};

export const float = ( s: any ): number => {
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