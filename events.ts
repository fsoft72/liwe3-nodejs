import { colors, info, warn } from './console_colors';
import { ILRequest } from './types';



type LiWEEventHandler = ( req: ILRequest, data: any ) => Promise<LiWEEventSingleResponse>;
const event_handlers: Record<NamedCurve, LiWEEventHandler[]> = {};

export type LiWEEventSingleResponse = { [ key: string ]: any; };
export type LiWEEventResponse = LiWEEventSingleResponse[];

/**
 * Registers an event handler for a specific event.
 *
 * @param modname - The name of the module.
 * @param event - The name of the event.
 * @param handler - The event handler function.
 *
 * @see liwe_event_unregister
 */
export const liwe_event_register = ( modname: string, event: string, handler: LiWEEventHandler ) => {
	event = event.toLowerCase().trim();

	info( colors.Yellow + modname + colors.Reset, "Event REGISTER", event );

	if ( !event_handlers[ event ] ) event_handlers[ event ] = [];
	event_handlers[ event ].push( handler );
};

/**
 * Emits a LiWE event and invokes all registered event handlers.
 * @param req - The ILRequest object.
 * @param event - The name of the event to emit.
 * @param data - The data associated with the event.
 * @returns A Promise that resolves to an array of LiWEEventResponse objects.
 */
export const liwe_event_emit = async ( req: ILRequest, event: string, data: any ) => {
	const response: LiWEEventResponse = [];

	event = event.toLowerCase().trim();

	if ( req.cfg?.debug?.enabled && req.cfg?.debug?.events ) console.log( "=== Event EMIT: ", event, data );

	const handlers = event_handlers[ event ];
	if ( !handlers ) return response;

	for ( let i = 0; i < handlers.length; i++ ) {
		const handler = handlers[ i ];
		const res = await handler( req, data );

		if ( res ) response.push( res );
	}

	return response;
};

/**
 * Unregisters an event handler for a specific event.
 *
 * @param event - The name of the event to unregister the handler from.
 * @param handler - The event handler function to unregister.
 *
 * @see liwe_event_register
 */
export const liwe_event_unregister = ( event: string, handler: LiWEEventHandler ) => {
	event = event.toLowerCase().trim();
	const handlers = event_handlers[ event ];
	if ( !handlers ) return;

	const idx = handlers.indexOf( handler );
	if ( idx >= 0 ) handlers.splice( idx, 1 );
};

/**
 * Retrieves the list of LIWE events.
 * @returns {string[]} The list of LIWE events.
 */
export const liwe_event_list = () => {
	return Object.keys( event_handlers );
};
