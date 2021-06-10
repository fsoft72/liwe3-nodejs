/** @ignore *//** */

// import { ILApplication } from './types';
import { arango_init, database_create, database_drop } from './arangodb';
import { Database } from 'arangojs';
import { ILiweConfig } from './types';
import { critical } from './console_colors';

export const db_init = async ( cfg: ILiweConfig ): Promise<Database> => {
	let DB_NAME = cfg.database.dbname;
	// const DB_SERVER = cfg.database.server;
	// const DB_PORT = cfg.database.port;

	const adb = await arango_init( cfg );

	if ( process.env.TEST_DB === "1" )
		DB_NAME = DB_NAME + "_TEST";

	if ( process.env.EMPTY_DB === "1" ) {
		critical( "DROPPING DB: ", DB_NAME );
		await database_drop( adb, DB_NAME );
	}

	const db = await database_create( adb, DB_NAME );

	return db;
};
