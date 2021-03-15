import { ILiweConfig } from "./types";

export const db_init = async ( cfg: ILiweConfig ): Promise<any> => {
	let init_db = null;

	if ( cfg.database.type === 'arangodb' ) {
		init_db = require( './db_init.arango' ).db_init;
	} else {
		init_db = require( './db_init.mongo' ).db_init;
	}

	return init_db( cfg );
};