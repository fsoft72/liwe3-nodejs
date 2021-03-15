import { Database } from "arangojs";
import { DocumentCollection } from "arangojs/collection";
// import { ILiweConfig } from "./types";
export interface DBCollectionIndex {
	type: "hash" | "persistent" | "skiplist" | "ttl" | "geo" | "fulltext";
	name?: string;
	fields: string[];
	unique: boolean;
	sparse?: boolean;
	deduplicate?: boolean;
}

export const arango_init = async ( cfg: any ): Promise<Database> => {
	const adb = new Database();
	await adb.exists();

	return adb;
};

export const database_create = async ( adb: Database, name: string ): Promise<Database> => {
	let db: Database;

	try {
		db = await adb.createDatabase( name );
	} catch ( e ) {
		db = await adb.database( name );
	}

	return db;
};

export const database_drop = async ( adb: Database, name: string ): Promise<boolean> => {
	let res = false;
	try {
		await adb.dropDatabase( name );
		res = true;
	} catch ( e ) {
		console.log( "ERROR: ", e );
		// throw ( e );
	}

	return res;
};

export const collection_create = async ( db: Database, name: string, force: boolean = false ): Promise<any> => {
	let coll;

	if ( force ) {
		coll = await db.collection( name );
		if ( coll ) {
			try {
				await coll.drop();
			} catch ( e ) { }
		}
	}

	try {
		coll = await db.createCollection( name );
		await coll.ensureIndex( { type: "persistent", fields: [ "created" ], unique: false } );
		await coll.ensureIndex( { type: "persistent", fields: [ "updated" ], unique: false } );
	} catch ( e ) {
		coll = await db.collection( name );
	}

	return coll;
};

export const collection_truncate = async ( db: Database, name: string ): Promise<boolean> => {
	const s = `FOR el IN ${ name } REMOVE el IN ${ name }`;
	await db.query( s );
	return true;
};

export const collection_add = async ( coll: DocumentCollection, data: any, force_insert: boolean = false ): Promise<any> => {
	let res: any;

	data.updated = new Date();
	if ( !force_insert && data._key ) {
		res = await coll.update( data._key, data, { returnNew: true } );
	} else {
		data.created = new Date();
		res = await coll.save( data, { returnNew: true } );
	}

	if ( res.new && res.new._key ) return res.new;
	return res;
};

export const collection_find_all = async ( db: Database, query: string, params: any = undefined ): Promise<any> => {
	console.log( "AQL query: ", query, params );
	const data: any = await db.query( query, params ); //, { count: true } );

	return await data.all();
};

export const collection_find_by_id = async ( coll: DocumentCollection, id: string ): Promise<any> => {
	try {
		const res = await coll.document( id );
		return res;
	} catch ( e ) {
		console.error( "Document with ID: %s not found", id );
		return null;
	}
};

export const collection_init = async ( db: Database, name: string, idx: DBCollectionIndex[] = null, force: boolean = false ) => {
	const coll = await collection_create( db, name, force );

	if ( idx && idx.length ) {
		await Promise.all( idx.map( ( p ) => {
			coll.ensureIndex( p );
		} ) );
	}

	return coll;
};

/*
const user_init_db = async ( db: Database ) => {
	const coll = collection_init( db, "users", [
		{ type: "persistent", fields: [ "email" ], unique: true }
	], true );

	return coll;
};

async function test () {
	const adb = await arango_init( null );
	const db = await database_create( adb, "fabio" );

	const users = await user_init_db( db );

	console.log( "INDEX: ", await users.indexes() );

	let user = { "email": "mario.rossi@gmail.com", "password": "ciao123", "enabled": true, "created": Date() };

	const res = await collection_add( users, user );
	user = { ...user, ...res };
	await collection_add( users, user );

	const usrs = await collection_find_all( db, 'FOR user IN users RETURN user' );

	console.log( "--- USERS: ", usrs );

	database_drop( adb, 'fabio' );
}
*/

// test();