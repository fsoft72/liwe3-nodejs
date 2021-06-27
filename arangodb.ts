import { Database } from "arangojs";
import { DocumentCollection } from "arangojs/collection";

import { config_load } from "./liwe";
import { ILiweConfig } from "./types";
import { unique_code } from "./utils";

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

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
		console.error( "ERROR: ", e );
		// throw ( e );
	}

	return res;
};

export const collection_create = async ( db: Database, name: string, drop: boolean = false ): Promise<any> => {
	let coll;

	if ( drop ) {
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
	if ( !force_insert && data._id ) {
		res = await coll.update( data._id, data, { returnNew: true } );
	} else {
		data.created = new Date();
		res = await coll.save( data, { returnNew: true } );
	}

	if ( res.new && res.new._key ) return res.new;
	return res;
};

export const collection_add_all = async ( coll: DocumentCollection, data: any ): Promise<any> => {
	let res: any;

	data.forEach( ( e: any ) => {
		e.updated = new Date();
		e.created = new Date();
	} );

	res = await coll.saveAll( data, { returnNew: true } );

	return res;
};

export const collection_find_all = async ( db: Database, query: string, params: any = undefined ): Promise<any> => {
	if ( cfg.debug?.query_dump ) console.log( "AQL query: ", query, params );
	const data: any = await db.query( query, params ); //, { count: true } );

	return await data.all();
};

export const collection_find_one = async ( db: Database, query: string, params: any = undefined ): Promise<any> => {
	return new Promise( async ( resolve, reject ) => {
		const res = await collection_find_all( db, query, params );

		if ( !res || !res.length ) return resolve( null );

		return resolve( res[ 0 ] );
	} );
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

/**
 * In `query` just put 'FOR ... IN ....' and FILTERs  (no RETURN)
 */
export const collection_count = async ( db: Database, query: string, params: any = undefined ): Promise<number> => {
	return new Promise( async ( resolve, reject ) => {
		query = `${ query } COLLECT WITH COUNT INTO length  RETURN length`;
		const res = await collection_find_one( db, query, params );

		if ( res === null ) return resolve( 0 );

		return resolve( res );
	} );
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

/**
 * Create filters and pagination (if skip and rows are defined)
 *
 * If rows == -1, then all rows are returned
 *
 * Returns [filters, values]
 */
export const prepare_filters = ( prefix: string, data: any, extra_values?: any ) => {
	if ( !extra_values ) extra_values = {};

	const my_data = { ...data };
	const values: any = { ...extra_values };
	const filters: string[] = [];
	const skip = my_data.skip || 0;
	const rows = my_data.rows || -1;

	delete my_data.skip;
	delete my_data.rows;

	const limit = rows != -1 ? ` LIMIT ${ skip }, ${ rows }` : '';

	Object.keys( my_data ).forEach( ( k: string ) => {
		let name;
		let mode = '==';
		let val;

		if ( typeof ( data[ k ] ) == 'undefined' ) return;
		if ( data[ k ] === null ) return;

		val = data[ k ];

		if ( typeof ( val ) == 'object' && val.val ) {
			mode = val.mode;
			name = val.name;
			val = val.val;
		} else {
			name = k;
		}

		values[ k ] = val;
		filters.push( `FILTER ${ prefix }.${ name } ${ mode } @${ k }` );
	} );

	return [ filters.join( ' ' ) + limit, values ];
};

export const mkid = ( prefix: string ) => {
	return unique_code( false, prefix );
};

export const collection_find_all_dict = async ( db: Database, coll_name: string, data: any ) => {
	const [ filters, values ] = prepare_filters( 'o', data );

	return await collection_find_all( db, `FOR o IN ${ coll_name } ${ filters } RETURN o`, values );
};

export const collection_find_one_dict = async ( db: Database, coll_name: string, data: any ) => {
	const [ filters, values ] = prepare_filters( 'o', data );

	return await collection_find_one( db, `FOR o IN ${ coll_name } ${ filters } RETURN o`, values );
};

export const collection_del_one_dict = async ( db: Database, coll_name: string, data: any ) => {
	const r = await collection_find_one_dict( db, coll_name, data );
	if ( !r ) return;
	const coll: DocumentCollection = db.collection( coll_name );
	if ( !coll ) return;

	await coll.remove( r._id );
};