import * as a from '../db/arango';

const cfg = {
	database: {
		type: "arangodb",
		dbname: 'test2',
		server: "http://localhost:8529",
		port: 27017,
		arangoVersion: 31203
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
	const pippo = await a.adb_record_add( db, COLL_USERS, { name: "Pippo" } );
	const pluto = await a.adb_record_add( db, COLL_USERS, { name: "Pluto" } );
	const topolino = await a.adb_record_add( db, COLL_USERS, { name: "Topolino" } );

	await a.adb_edge_create( db, COLL_RELATIONS, mario, luigi );
	await a.adb_edge_create( db, COLL_RELATIONS, mario, topolino );
	await a.adb_edge_create( db, COLL_RELATIONS, mario, pluto );
	await a.adb_edge_create( db, COLL_RELATIONS, mario, pippo );
	await a.adb_edge_create( db, COLL_RELATIONS, pluto, pippo );
	await a.adb_edge_create( db, COLL_RELATIONS, pluto, mario );
	await a.adb_edge_create( db, COLL_RELATIONS, topolino, pippo );

	Array.from( [ 'in', 'out', 'any' ] ).forEach( async ( dir ) => {
		const edges = await a.adb_edges_find( db, COLL_RELATIONS, mario, ( dir as 'in' | 'out' | 'any' ) );
		console.log( `=== EDGES ${ dir }`, edges );
	} );

	console.log( "=== FINE" );
};

test01();