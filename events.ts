import { colors, info, warn } from './console_colors';
import { ILRequest } from './types';

type LiWEEventHandler = ( req: ILRequest, data: any ) => Promise<void>;
const event_handlers: Record<NamedCurve, LiWEEventHandler[]> = {};

export const liwe_event_register = ( modname: string, event: string, handler: LiWEEventHandler ) => {
	event = event.toLowerCase().trim();

	info( colors.Yellow + modname + colors.Reset, "Event REGISTER", event );

	if ( !event_handlers[ event ] ) event_handlers[ event ] = [];
	event_handlers[ event ].push( handler );
};

export const liwe_event_emit = async ( req: ILRequest, event: string, data: any ) => {
	event = event.toLowerCase().trim();

	console.log( "=== Event EMIT: ", event, data );

	const handlers = event_handlers[ event ];
	if ( !handlers ) return;

	for ( let i = 0; i < handlers.length; i++ ) {
		const handler = handlers[ i ];
		await handler( req, data );
	}
};

export const liwe_event_unregister = ( event: string, handler: LiWEEventHandler ) => {
	event = event.toLowerCase().trim();
	const handlers = event_handlers[ event ];
	if ( !handlers ) return;

	const idx = handlers.indexOf( handler );
	if ( idx >= 0 ) handlers.splice( idx, 1 );
};

export const liwe_event_list = () => {
	return Object.keys( event_handlers );
};
