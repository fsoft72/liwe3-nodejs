/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from 'path';
import * as express from 'express';

import * as fs from './fs';
import { ILRequest, ILResponse, ILApplication, ILNextFunction, ILiWE, ILiweConfig, LiWEServerOptions } from './types';
import { public_fullpath, upload_fullpath, make_default_dirs, temp_fullpath, module_fullpath, config_load } from './liwe';
import Defender, { applySettings } from './defender';
import Throttler, { applySettings as applyThrottlerSettings } from './throttler';
// import { SocketIORouter } from './socketio';

/** @ignore */
/*
const locale = ( app: ILApplication, cfg: ILiweConfig ) => {
	const { loc, express_init } = require( './locale' );

	loc.set_default_language( cfg.app.default_language || 'en' );

	express_init( app );
};
*/

/** @ignore */
const _cors = ( app: ILApplication, cfg: ILiweConfig ) => {
	const cors = require( 'cors' );

	const corsOptions = {
		origin: true,
		credentials: true
	};

	app.use( cors( corsOptions ) );
};

/** @ignore */
const augment_request = ( app: ILApplication, cfg: ILiweConfig, db: any ) => {
	app.use( ( req: ILRequest, res: ILResponse, next: ILNextFunction ) => {
		req.cfg = cfg;
		req.db = db;
		req.res = res;
		// req.socketio = app.socket;
		next();
	} );
};

/** @ignore */
const _module_init = ( name: string, liwe: ILiWE ) => {
	const mod_dirname = module_fullpath( name );
	if ( !fs.exists( mod_dirname ) ) {
		console.error( `*** ERROR: module ${ name } not found in ${ mod_dirname }` );
		return;
	}

	require( `${ mod_dirname }/endpoints` ).init( liwe );
};

/*
const _startup_server = async ( cfg: ILiweConfig, forced_port: number = 0 ): Promise<any> => {
	const app = express();

	return app;
};
*/

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
		db: null,
	};

	liwe.cwd = path.join( __dirname, '../..' );

	const db = await require( './db_init' ).db_init( cfg );

	liwe.db = db;

	return liwe;
};

/** @ignore */
const _socket_io_router = ( app: ILApplication, cfg: ILiweConfig ) => {
	if ( !cfg.features.socketio ) return;

	// app.socket = new SocketIORouter( cfg.features.socketio_debug );
};

/**
 * This is the main function that startups the whole LiWE Framework
 *
 * @returns an initialized ILiWE structure
 */
export const startup = async ( options: LiWEServerOptions = {} ): Promise<ILiWE> => {
	const liwe = await startup_kernel();

	if ( !liwe.cfg.warns ) liwe.cfg.warns = {};

	// _socket_io_router( app, cfg );

	liwe.app = express();
	// liwe.app = await _startup_server( liwe.cfg );

	make_default_dirs( upload_fullpath( 'temp' ) );
	make_default_dirs( temp_fullpath() );

	// locale( app, cfg );
	// _session( app, cfg );
	// const liwe_data: ILiWE = { app, cwd, app_name, cfg, port, module_init: null };

	liwe.module_init = ( name: string ) => _module_init( name, liwe );

	return liwe;
};

export const _retrive_all_mods = () => {
	const basepath = module_fullpath();
	const res: string[] = [];

	fs.readdir( basepath ).forEach( ( p ) => {
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
	if ( !cfg.security.defender.enabled ) {
		console.warn( "WARNING: Defender disabled" );
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
	if ( !cfg.security.throttler.enabled ) {
		console.warn( "WARNING: Throttler disabled" );
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

	_defender( liwe.app, liwe.cfg );
	_throttler( liwe.app, liwe.cfg );

	_cors( liwe.app, liwe.cfg );

	// This line parses JSON requests
	liwe.app.use( express.json( { limit: liwe.cfg.server.max_post_size } ) );
	liwe.app.use( express.urlencoded( { extended: true } ) );
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

	// =======================================================
	// SITE ENDPOINTS
	// =======================================================

	console.log( '\n\n=========================' );
	console.log( 'Modules INIT: ' );

	if ( !modules || !modules.length ) modules = _retrive_all_mods();

	liwe.module_init( 'user' );

	modules.forEach( ( m ) => {
		if ( m !== 'user' ) liwe.module_init( m );
	} );

	console.log( '=========================\n\n' );

	liwe.app.get( '*', ( req, res ) => {
		const url = req.originalUrl.replace( '/static/public', '' );
		const fname = public_fullpath( url );
		if ( fs.exists( fname ) ) return res.sendFile( fname );

		console.error( 'MISSING URL: ', req.originalUrl, url, fname );
		res.sendFile( public_fullpath( 'index.html' ) );
	} );

	const http = liwe.app.listen( liwe.port, () => {
		console.log( `${ liwe.app_name } started on port: ${ liwe.port }.  http://localhost:${ liwe.port }` );
	} );

	// if ( liwe.app.socket ) liwe.app.socket.init( http );

	if ( liwe.cfg.app.debug ) console.log( '\n== App started in DEBUG MODE ==' );

	return liwe;
};
