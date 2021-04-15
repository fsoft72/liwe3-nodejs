import { ILiweConfig } from "./types";

export const db_init = async ( cfg: ILiweConfig ): Promise<any> => {
	let init_db = null;

	console.log( "DB Type: %s - TEST: %d - EMPTY: %d", cfg.database.type, process.env.TEST_DB || 0, process.env.EMPTY_DB || 0 );

	if ( cfg.database.type === 'arangodb' ) {
		init_db = require( './db_init.arango' ).db_init;
	} else {
		init_db = require( './db_init.mongo' ).db_init;
	}

	return init_db( cfg );
};