import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import * as url_parser from 'url';

import { ILError } from './types';

export interface IHTTPReqOptions {
	/** Base url (if you give relative path) */
	base_url?: string;

	/** Post number */
	port?: number;

	/** timeout in millis (default no timeout) */
	timeout?: number;

	/** Default charset */
	charset?: string;

	/** Request headers */
	headers?: any;
}

interface IHTTPReqFullOptions extends IHTTPReqOptions {
	path?: string;
	method?: string;
	full_url?: string;
	/** GET search parameters */
	params?: string;

	query?: any;

	/** The protocol http / https */
	protocol?: string;
}

class HTTPResponse {
	public status_code: number = 0;
	public data: any = null;
	public options: IHTTPReqFullOptions;
	public error: any = null;
	public headers: any = null;

	constructor ( options: IHTTPReqFullOptions ) {
		this.options = options;
		this.headers = null;
	}

	public set_data ( result: any ) {
		try {
			this.data = JSON.parse( result );
		} catch ( e ) {
			this.data = result;
		}
	}
}

/**
 * HTTPReq is a class to make http and https requests.
 * It accepts both Promise and callback interfaces and it is very simple to use.
 * `gzip` and `brotli` compressed responses are uncompressed transparently.
 * Also, if the response is a JSON object, it will be parsed automaticaly upon success.
 *
 * POST requests can be both JSON objects or Form urlencoded strings. The class detects it automatically
 * and translates to the right content type.
 *
 * GET requests can have query parameters on both URLs and as a query object (key, value).
 *
 * The HTTPReq class supports requests timeouts.
 */
// tslint:disable-next-line: max-classes-per-file
export class HTTPReq {
	private globs: IHTTPReqOptions;

	constructor ( defaults: IHTTPReqOptions = {} ) {
		this.globs = defaults;
	}

	public post ( url: string, data: any, options: IHTTPReqOptions = {}, cback: any = null ) {
		const my_options: IHTTPReqFullOptions = { ...this.globs, ...options, method: 'POST' };

		this._resolve_req_data( url, my_options );

		const new_data = this._resolve_headers( data, my_options );
		return this._mk_req( new_data, my_options, cback );
	}

	public get ( url: string, query: any = {}, options: IHTTPReqOptions = {}, cback: any = null ) {
		const my_options: IHTTPReqFullOptions = { ...this.globs, ...options, method: 'GET' };
		my_options[ 'query' ] = { ...query };

		this._resolve_req_data( url, my_options );

		const new_data = this._resolve_headers( null, my_options );
		return this._mk_req( new_data, my_options, cback );
	}

	// =====================================================================================
	// PRIVATE FUNCTIONS
	// =====================================================================================

	private _mk_req ( data: any, options: IHTTPReqFullOptions, cback: any = null ): Promise<HTTPResponse> {
		const h = options.protocol === 'https:' ? https : http;
		const rx = new HTTPResponse( options );

		return new Promise( ( resolve, reject ) => {
			const url = options.full_url;

			const req = h.request( url, options, ( res ) => {
				rx.status_code = res.statusCode;
				rx.headers = res.headers;

				this._create_streamer( res, ( err: ILError, data: any ) => {
					if ( err ) return cback ? cback( err ) : reject( err );

					rx.set_data( data );

					return cback ? cback( null, rx ) : resolve( rx );
				} );
			} );

			req.on( 'error', ( err ) => {
				return cback ? cback( err ) : reject( err );
			} );

			req.on( 'timeout', () => {
				console.log( 'REQ TIMEOUT' );
				req.abort();
			} );

			if ( data ) req.write( data );
			req.end();
		} );
	}

	private _create_streamer = ( res: http.IncomingMessage, cback: any ) => {
		const h = res.headers;
		let pipe: any = null;
		const buffer: string[] = [];

		// console.log( 'ENCODING: ', h[ 'content-encoding' ] );

		switch ( h[ 'content-encoding' ] ) {
			case 'gzip':
				pipe = zlib.createGunzip();
				break;
			case 'br':
				pipe = zlib.createBrotliDecompress();
				break;
		}

		// If pipe exists we set the pipe to the request
		if ( pipe ) res.pipe( pipe );
		else pipe = res; // we reuse the 'pipe' variable in case no compression is available

		pipe
			.on( 'data', function ( data: any ) {
				// decompression chunk ready, add it to the buffer
				buffer.push( data.toString() );
			} )
			.on( 'end', function () {
				// response and decompression complete, join the buffer and return
				cback( null, buffer.join( '' ) );
			} )
			// req error
			.on( 'error', function ( err: ILError ) {
				cback( err );
			} );
	};

	private _resolve_req_data ( url: string, options: IHTTPReqFullOptions ) {
		const u = new url_parser.URL( '', url );  // options.base_url );

		if ( options.method === 'GET' ) {
			Object.keys( options.query ).forEach( ( k ) => u.searchParams.set( k, options.query[ k ] ) );

			options.params = u.searchParams.toString();
			if ( options.params && options.params.length ) options.params = '?' + options.params;
		}

		// console.log( 'U: ', u );

		if ( !options.port && u.port ) options.port = parseInt( u.port, 10 );
		options.protocol = u.protocol;
		options.path = `${ u.pathname }${ options.params }`;

		if ( !options.port ) {
			options.port = 80;
			if ( options.protocol === 'https:' ) options.port = 443;
		}

		options.full_url = `${ u.href }`; // `${ options.base_url }${ options.path }${ options.params }`;
	}

	private _resolve_headers ( data: any, options: IHTTPReqFullOptions ) {
		const heads = {
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Encoding': 'gzip,br'
		};

		const h = options.headers || {};
		const headers = { ...h, ...heads };

		if ( data ) {
			headers[ 'Content-Type' ] = `application/x-www-form-urlencoded; charset=${ options.charset || 'UTF-8' }`;
			if ( typeof data !== 'string' ) {
				data = JSON.stringify( data );
				headers[ 'Content-Type' ] = `application/json; charset=${ options.charset || 'UTF-8' }`;
			}
			headers[ 'Content-Length' ] = data.length;
		}

		options.headers = { ...headers };

		return data;
	}
}
