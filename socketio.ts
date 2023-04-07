import * as io from 'socket.io';
// import * as express from 'express';
import * as http from 'http';
import { ILError } from './types';

interface ServerToClientEvents {
	broadcast: ( type: string, payload: any ) => void;
	echo: ( type: string, payload: any ) => void;
}

interface ClientToServerEvents {
	hello: ( type: string, payload: any ) => void;
}

interface InterServerEvents {
	ping: () => void;
}

interface SocketData {
	name: string;
	payload: any;
}



/**
 * The ILiWESocketMessage defines the type of message handled by SocketIORouter
 * All the messages in LiWE Socket.IO implementation have the same signature
 * similar to Redux dispatch bundle.
 */
export interface ILiWESocketMessage {
	/** the name of the message sent. This is defined by the app and usually is something like 'news.add' */
	action: string;
	/** payload is an object with key / anything type. App can put what it want in the payload */
	payload: {
		[ key: string ]: any;
	};
}

/**
 * The SocketIORouter class is a singleton class created directly by liwe.startup () and defines the internal LiWE implementation
 * of Socke.IO lib.
 *
 */
export class SocketIORouter {
	/** Instance of the Socke.IO server */
	private io: io.Server;

	/** An object containing all the registered events */
	private events: any;
	/** If true, SocketIORouter will dump some debug messages on console */
	private debug: boolean;

	private listeners: any;

	constructor ( debug: boolean = false ) {
		this.events = {};
		this.listeners = {};
		this.debug = debug;
	}

	/** This method is called to init the library.
	 *
	 * @param http The Express.js HTTP server instance (already started)
	 * @param port The Socket.IO listening port
	 */
	public init ( http: http.Server, port: number = 3001 ) {
		this.io = new io.Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>( port, {
			cors: {
				origin: '*',
				methods: [ 'GET', 'POST' ],
			},
		} );

		this.io.on( 'connect', this.io_init );

		console.log( `=======  Socket.IO server started on port: ${ port }` );
	}

	public listener_add ( name: string, cback: any ) {
		this.listeners[ name ] = cback;
	}

	public listener_del ( name: string ) {
		delete this.listeners[ name ];
	}

	/** Register a new LiWE SocketIO Router action to the system
	 *
	 * @param action  The event name, usually in the form of `class.event_name`
	 * @param cback The real function that will handle the registered event
	 */
	public register ( action: string, cback: any ) {
		if ( this.debug ) console.log( 'REGISTER ACTION: ', action );
		this.events[ action ] = cback;
	}

	/** Broadcast an event to all registered peers.
	 *
	 * @param action the action name
	 * @param payload the action payload
	 */
	public broadcast ( action: string, payload: any ) {
		const p = { action, payload };

		if ( this.debug ) console.log( 'SocketIO: broadcasting: ', p );

		this.io.emit( 'liwe.msg', p );
	}

	public send_direct_raw ( socket_id: string, action: string, payload: any ) {
		this.io.to( socket_id ).emit( JSON.stringify( { action, payload } ) );
	}

	private io_init = ( socket: io.Socket ) => {
		socket.on( 'disconnect', () => {
			console.log( 'DISCONNECT: ', socket.id );
		} );

		socket.on( 'liwe.echo.raw', ( msg: string ) => {
			if ( this.debug ) console.log( 'TEST MESS: ', msg );
			this.io.emit( 'liwe.echo.raw', `ECHO: ${ JSON.stringify( msg ) }` );
		} );

		socket.on( 'liwe.msg', ( msg: ILiWESocketMessage ) => {
			console.log( '===== LIWE MESSAGE: ', msg );
			if ( this.debug ) console.log( 'LIWE MESSAGE: ', msg );
			const act = this.events[ msg.action ];

			if ( this.debug ) console.log( 'ACT: ', act );

			if ( !act ) {
				socket.emit( 'liwe.msg', { error: 404, message: `Action not found: ${ msg.action }` } );
				return;
			}

			act( msg.payload, ( err: ILError, res: any ) => {
				console.log( 'ERR: ', err );
				if ( err ) {
					socket.emit( 'liwe.msg', { error: 500, ...err } );
					return;
				}

				if ( res.broadcast ) this.broadcast( msg.action, res );
				else socket.emit( 'liwe.msg', { action: msg.action, payload: res } );
			} );
		} );

		const keys = Object.keys( this.listeners );

		keys.forEach( ( k ) => {
			socket.on( k, ( msg: any ) => this.listeners[ k ]( socket, msg ) );
		} );
	};
}
