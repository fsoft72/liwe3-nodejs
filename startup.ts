/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from 'path';
import * as express from 'express';
import * as bodyParser from 'body-parser';

import * as fs from './fs';
import { ILRequest, ILResponse, ILApplication, ILNextFunction, ILiWE, ILiweConfig, LiWEServerOptions, ILError } from './types';
import { public_fullpath, upload_fullpath, make_default_dirs, temp_fullpath, module_fullpath, config_load } from './liwe';
import Defender, { applySettings } from './defender';
import Throttler, { applySettings as applyThrottlerSettings } from './throttler';
import SSEServer from './sse';

import { info, warn, colors, error } from './console_colors';
// import { loc } from './locale';
import * as fileUpload from 'express-fileupload';
import { adb_init } from './db/arango';

import { SocketIORouter } from './socketio';
import { mkid } from './utils';

const locale = ( liwe: ILiWE ) => {
	const { loc, express_init } = require( './locale' );

	loc.set_default_language( liwe.cfg.app.default_language || 'en' );

	express_init( liwe.app );
};

/** @ignore */
const _cors = ( app: ILApplication, cfg: ILiweConfig ) => {
	const cors = require( 'cors' );

	const corsOptions = {
		origin: true,
		credentials: true
	};

	app.use( cors( corsOptions ) );
};

const _db_init = async ( cfg: ILiweConfig ): Promise<any> => {
	if ( cfg.database.disabled ) {
		info( `DB: ${ colors.Yellow }disabled${ colors.Reset }` );
		return null;
	}

	info( `DB Name: ${ colors.Yellow }${ cfg.database.dbname }${ colors.Reset } - Type: ${ colors.Yellow }${ cfg.database.type }${ colors.Reset } - TEST: ${ colors.Yellow }${ process.env.TEST_DB || 0 }${ colors.Reset } - EMPTY: ${ colors.Yellow }${ process.env.EMPTY_DB || 0 }${ colors.Reset }` );

	return adb_init( cfg );
};

/** @ignore */
const augment_request = ( app: ILApplication, cfg: ILiweConfig, db: any ) => {
	app.use( ( req: ILRequest, res: ILResponse, next: ILNextFunction ) => {
		req.cfg = cfg;
		req.db = db;
		req.res = res;
		req.socketio = app.socket;
		next();
	} );
};

/** @ignore */
const _module_init = async ( name: string, liwe: ILiWE ) => {
	const mod_dirname = module_fullpath( name );
	if ( !fs.exists( mod_dirname ) ) {
		console.error( `*** ERROR: module ${ name } not found in ${ mod_dirname }` );
		return;
	}

	const methods = require( `${ mod_dirname }/methods` );

	methods.middleware_init && await methods.middleware_init( liwe );
	methods.init && await methods.init( liwe );

	await require( `${ mod_dirname }/endpoints` ).init( liwe );
};

/**
 * Bootstraps the whole LiWE Framework
 * This is the "kernel" version since it only creates the basic settings.
 * This method is useful in tests to bootstrap a working environment.
 *
 * @returns an object with all basic components inited
 */
export const startup_kernel = async (): Promise<ILiWE> => {
	const cfg: ILiweConfig = config_load( 'data', {}, true );

	const liwe: ILiWE = {
		app: null,
		app_name: cfg.app.name,
		cfg,
		cwd: '',
		module_init: null,
		port: cfg.server.port,
		sse: null,
		db: null,
		startDate: new Date().getTime(),
	};

	if ( !cfg?.app?.languages ) {
		warn( "cfg.app.languages not defined" );
		cfg.app.languages = [ 'en' ];
	}

	if ( !cfg?.upload.sizes ) {
		warn( "cfg.upload.sizes not defined" );
		cfg.upload.sizes = {
			thumb: 200,
			small: 400,
			medium: 800,
			large: 1200,
		};
	}

	if ( !cfg.debug.challenge ) {
		warn( "cfg.debug.challenge not defined" );
		cfg.debug.challenge = mkid( 'challenge' );
	}

	liwe.cwd = path.join( __dirname, '../..' );

	liwe.db = await _db_init( cfg );  // require( './db_init' ).db_init( cfg );

	info( "Public path: " + public_fullpath() );

	return liwe;
};

/** @ignore */
const _socket_io_router = ( app: ILApplication, cfg: ILiweConfig ) => {
	if ( !cfg.features.socketio ) return;

	app.socket = new SocketIORouter( cfg.features.socketio_debug );
};

const _sse_server = ( liwe: ILiWE, cfg: ILiweConfig ) => {
	if ( !cfg.features.sse ) return;

	liwe.sse = new SSEServer( liwe.app, cfg.features.sse_debug );
};

/**
 * This is the main function that startups the whole LiWE Framework
 *
 * @returns an initialized ILiWE structure
 */
export const startup = async ( options: LiWEServerOptions = {} ): Promise<ILiWE> => {
	const liwe = await startup_kernel();

	if ( !liwe.cfg.warns ) liwe.cfg.warns = {};

	liwe.app = express();
	_socket_io_router( liwe.app, liwe.cfg );
	_sse_server( liwe, liwe.cfg );



	make_default_dirs( upload_fullpath( 'temp' ) );
	make_default_dirs( temp_fullpath() );

	locale( liwe );
	// _session( app, cfg );
	// const liwe_data: ILiWE = { app, cwd, app_name, cfg, port, module_init: null };

	liwe.module_init = ( name: string ) => _module_init( name, liwe );

	return liwe;
};

export const _retrive_all_mods = () => {
	const basepath = module_fullpath();
	const res: string[] = [];

	fs.readdir( basepath ).forEach( ( p ) => {
		if ( p.startsWith( '_' ) ) return;
		if ( fs.stat( path.join( basepath, p ) ).isDirectory() ) res.push( p );
	} );

	return res;
};

/** @ignore */
const _express_trace = ( app: ILApplication, cfg: ILiweConfig ) => {
	if ( cfg.features.trace ) {
		const trace_request = require( './express' ).trace_request;
		app.use( trace_request );
	}
};

const _defender = ( app: ILApplication, cfg: ILiweConfig ) => {
	if ( !cfg?.security?.defender ) {
		warn( "defender section not defined in cfg.security" );
		return;
	}

	if ( !cfg?.security?.defender?.enabled ) {
		warn( "Defender disabled" );
		return;
	}

	app.use( Defender );
	applySettings( {
		blacklistTimeout: cfg.security.defender.blacklist_timeout,
		maxAttempts: cfg.security.defender.max_attempts,
		parseFragments: cfg.security.defender.parse_fragments,
		dropSuspiciousRequest: cfg.security.defender.drop_requests,
		suspiciousTimeout: cfg.security.defender.suspicious_timeout,
	} );
};

const _throttler = ( app: ILApplication, cfg: ILiweConfig ) => {
	if ( !cfg.security.throttler ) {
		warn( "Throttler section not defined in cfg.security" );
		return;
	}

	if ( !cfg.security.throttler.enabled ) {
		warn( "Throttler disabled" );
		return;
	}

	app.use( Throttler );
	applyThrottlerSettings( {
		requestCount: cfg.security.throttler.request_count,
		requestInterval: cfg.security.throttler.request_interval,
		waitTime: cfg.security.throttler.wait_time
	} );
};

export const server = async ( modules: string[], options: LiWEServerOptions = {} ): Promise<ILiWE> => {
	const liwe = await startup( options );
	const port: number = parseInt( process.env.PORT, 10 ) || liwe.cfg.server.port;

	liwe.port = port;

	augment_request( liwe.app, liwe.cfg, liwe.db );

	// Note that this option available for versions 1.0.0 and newer.
	liwe.app.use( fileUpload( {
		useTempFiles: true,
		tempFileDir: '/tmp/',
		preserveExtension: true,
		abortOnLimit: true,
		uriDecodeFileNames: true,
		safeFileNames: true,
		// fileSize: liwe.cfg.server.max_post_size * 1024 * 1024,
	} ) );

	_defender( liwe.app, liwe.cfg );
	_throttler( liwe.app, liwe.cfg );
	_cors( liwe.app, liwe.cfg );
	liwe.app.use( bodyParser.json( { limit: `${ liwe.cfg.upload.max_upload_size }mb` } ) );
	liwe.app.use( bodyParser.urlencoded( { extended: true, limit: `${ liwe.cfg.upload.max_upload_size }mb` } ) );

	if ( !liwe.cfg?.security?.remote ) {
		error( "cfg.security.remote not defined" );
		if ( liwe.cfg?.server?.block_on_errors ) process.exit( 1 );
	}

	// This line parses JSON requests
	//liwe.app.use( express.json( { limit: '25mb' } ) );   // liwe.cfg.server.max_post_size } ) );
	//liwe.app.use( express.urlencoded( { extended: true, limit: '25mb' } ) );

	_express_trace( liwe.app, liwe.cfg );

	// curl( app, cfg );
	// restest( app, cfg );

	if ( liwe.cfg.server.dump_ip ) {
		liwe.app.set( 'trust proxy', true );
		liwe.app.use( ( req, res, next ) => {
			console.log( "REMOTE IP: ", req.ip );
			next();
		} );
	}

	// Add extra middlewares (if any)
	if ( options?.middlewares ) {
		options.middlewares.forEach( ( m ) => liwe.app.use( m ) );
	}

	// =======================================================
	// SITE ENDPOINTS
	// =======================================================

	console.log( '\n\n=========================' );
	console.log( 'Modules INIT: ' );

	if ( !modules || !modules.length ) modules = _retrive_all_mods();

	// bootstrap of main modules
	const mods: string[] = liwe.cfg.app.startup?.modules || [];

	await Promise.all( mods.map( async ( m ) => await liwe.module_init( m ) ) );

	// init of remaining modules
	await Promise.all( modules.map( async ( m ) => {
		if ( mods.indexOf( m ) != -1 ) return null;
		return await liwe.module_init( m );
	}
	) );

	console.log( '=========================\n\n' );

	liwe.app.get( '*', ( req, res ) => {
		const url = req.originalUrl.replace( '/static/public', '' );
		let fname = public_fullpath( url );

		console.log( "=== URL: ", req.originalUrl, fname );

		// remove query string
		fname = fname.split( '?' )[ 0 ];

		if ( fs.isFile( fname ) ) return res.sendFile( fname );
		if ( fs.isFile( `${ fname }/index.html` ) ) return res.sendFile( `${ fname }/index.html` );

		console.error( 'MISSING URL: ', req.originalUrl, url, fname );

		return res.status( 404 ).send( 'Not found' );
		// res.sendFile( public_fullpath( 'index.html' ) );
	} );

	const http = liwe.app.listen( liwe.port, () => {
		console.log( `${ liwe.app_name } started on port: ${ liwe.port }.  http://localhost:${ liwe.port }` );
	} );

	if ( liwe.app.socket ) liwe.app.socket.init( http, liwe.port + 1 );

	if ( liwe.cfg?.debug?.enabled ) console.log( '\n== App started in DEBUG MODE ==' );

	return liwe;
};
