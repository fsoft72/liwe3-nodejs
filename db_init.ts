import { ILiweConfig } from "./types";
import { info, colors } from './console_colors';

export const db_init = async ( cfg: ILiweConfig ): Promise<any> => {
	let init_db = null;

	info( `DB Name: ${ colors.Yellow }${ cfg.database.dbname }${ colors.Reset } - Type: ${ colors.Yellow }${ cfg.database.type }${ colors.Reset } - TEST: ${ colors.Yellow }${ process.env.TEST_DB || 0 }${ colors.Reset } - EMPTY: ${ colors.Yellow }${ process.env.EMPTY_DB || 0 }${ colors.Reset }` );

	if ( cfg.database.type === 'arangodb' ) {
		init_db = require( './db_init.arango' ).db_init;
	} else {
		init_db = require( './db_init.mongo' ).db_init;
	}

	return init_db( cfg );
};