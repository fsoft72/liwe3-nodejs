import * as a from '../db/arango';

const cfg = {
	database: {
		type: "arangodb",
		dbname: 'test2',
		server: "http://localhost:8529",
		port: 27017
	}
};

const COLL_USERS = 'users';
const COLL_RELATIONS = 'relations';

const test01 = async () => {
	const db = await a.adb_init( cfg as any );
	// const db = await a.adb_db_create( adb, cfg.database.dbname );

	const collection = await a.adb_collection_create( db, COLL_USERS );
	const edgeColl = await a.adb_collection_create( db, COLL_RELATIONS, { edge: true } );

	const mario = await a.adb_record_add( db, COLL_USERS, { name: "Mario" } );
	const luigi = await a.adb_record_add( db, COLL_USERS, { name: "Luigi" } );

	const rel = await a.adb_edge_create( db, COLL_RELATIONS, mario, luigi );

	const find = await a.adb_edges_find( db, COLL_RELATIONS, mario, "outbound" );

	console.log( "=== FIND", find );




	console.log( "=== FINE" );
};

test01();