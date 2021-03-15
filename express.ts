/** @ignore *//** */

import { ILRequest, ILResponse } from './types';

export const trace_request = ( req: ILRequest, res: ILResponse, next: any ) => {
	const txt = [];

	txt.push( "\n==============================================================================" );
	txt.push( `===   ${ new Date() }` );
	txt.push( "==============================================================================" );
	txt.push( `${ req.method } ${ req.originalUrl }` );
	txt.push( "====================== HEADERS                ================================" );
	for ( const k in req.headers )
		txt.push( k + ": " + req.headers[ k ] );
	txt.push( "====================== HEADERS                ================================" );

	if ( req.method === 'POST' )
		txt.push( JSON.stringify( req.body, null, 4 ) );
	else {
		txt.push( JSON.stringify( req.url, null, 4 ) );
	}
	txt.push( "==============================================================================" );

	console.log( txt.join( "\n" ) );

	next();
};