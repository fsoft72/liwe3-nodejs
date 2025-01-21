import * as express from 'express';
import { Request, Response } from 'express';
import { info, colors } from './console_colors';

interface SSEClient {
	id: string;
	response: Response;
}

interface SSEMessage {
	action: string;
	data: any;
}

class SSEServer {
	private clients: Map<string, SSEClient>;
	private app: express.Application;
	private debug: boolean;

	constructor ( app: express.Application, debug = false ) {
		this.clients = new Map();
		this.app = app;
		this.debug = debug;

		// Setup SSE endpoint
		this.setupSSEEndpoint();

		if ( this.debug ) {
			info( `SSE: Server Sent Event ${ colors.Yellow }started${ colors.Reset }` );
		}

	}

	private setupSSEEndpoint (): void {
		this.app.get( '/sse', ( req: Request, res: Response ) => {
			// Set headers for SSE
			res.writeHead( 200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			} );

			// Generate a unique client ID
			const clientId = Date.now().toString();

			// Create new client
			const client: SSEClient = {
				id: clientId,
				response: res
			};

			// Add client to the map
			this.clients.set( clientId, client );

			// Handle client disconnect
			req.on( 'close', () => {
				this.clients.delete( clientId );
			} );
		} );
	}

	/**
	 * Send a message to a specific client
	 */
	private sendToClient ( client: SSEClient, message: SSEMessage ): void {
		client.response.write( `data: ${ JSON.stringify( message ) }\n\n` );
	}

	/**
	 * Broadcast a message to all connected clients
	 */
	public broadcast ( message: SSEMessage ): void {
		this.clients.forEach( client => {
			this.sendToClient( client, message );
		} );
	}

	/**
	 * Send a message to a specific client by ID
	 */
	public sendToClientById ( clientId: string, message: SSEMessage ): boolean {
		const client = this.clients.get( clientId );
		if ( client ) {
			this.sendToClient( client, message );
			return true;
		}
		return false;
	}

	/**
	 * Get the count of connected clients
	 */
	public getConnectedClientsCount (): number {
		return this.clients.size;
	}
}

/*
// Example usage
const server = new SSEServer();
server.start();

// Example endpoint to trigger a broadcast
server.app.post( '/broadcast', ( req: Request, res: Response ) => {
	const message: SSEMessage = req.body;
	server.broadcast( message );
	res.json( { success: true, clientsNotified: server.getConnectedClientsCount() } );
} );
 */

export default SSEServer;