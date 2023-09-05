/** @ignore *//** */

// import { ILApplication } from './types';
import { Database } from 'arangojs';
import { ILiweConfig } from '../types';
import { critical, error } from '../console_colors';
import { DocumentCollection } from "arangojs/collection";

import { config_load } from "../liwe";
import { keys_filter } from "../utils";

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

export interface QueryOptions {
	/** If T, the query will return also the count of documents */
	count?: boolean;
	/** The pagination starting point */
	skip?: number;
	/** The number of documents to return */
	rows?: number;
}

export interface DBCollectionIndex {
	type: "hash" | "persistent" | "skiplist" | "ttl" | "geo" | "fulltext";
	name?: string;
	fields: string[];
	unique: boolean;
	sparse?: boolean;
	deduplicate?: boolean;
}

export interface DBCollectionCreateOptions {
	/** Set this to true if you want to drop the collection if it already exists. */
	drop?: boolean;
}

interface SortOptions {
	field: string;
	desc?: number;
}

interface CollectionFindAllOptions {
	rows?: number;
	skip?: number;
	sort?: SortOptions[];

	/** If T, the query will return also the count of documents */
	count?: boolean;
}

const _check_default_analyzers = async ( db: Database ) => {
	const analyzers = [ 'norm_it', 'norm_en' ];

	await Promise.all( analyzers.map( async ( name ) => {
		const analyzer = db.analyzer( name );
		if ( !analyzer || !( await analyzer.exists() ) ) {
			console.log( `  -- DB: Analyzer ${ name } MISSING` );

			const locale = name == 'norm_en' ? 'en.utf-8' : 'it.utf-8';

			analyzer.create( { type: 'norm', properties: { locale, accent: false, case: "lower" } } );
		}
	} ) );
};

// gets a collection by its name, returns null if it does not exist
const _collection_get = ( db: Database, coll_name: string, raise: boolean = true ): DocumentCollection => {
	if ( !db ) return null;

	const coll: DocumentCollection = db.collection( coll_name );

	if ( !coll && raise ) throw ( new Error( `Collection ${ coll_name } does not exist` ) );

	return coll;
};


/**
 * ArangoDB database initialization
 */
export const adb_init = async ( cfg: ILiweConfig ): Promise<Database> => {
	let DB_NAME = cfg.database.dbname;

	const adb = new Database();
	await adb.exists();

	if ( process.env.TEST_DB === "1" )
		DB_NAME = DB_NAME + "_TEST";

	if ( process.env.EMPTY_DB === "1" ) {
		critical( "DROPPING DB: ", DB_NAME );
		await adb_db_drop( adb, DB_NAME );
	}

	const db = await adb_db_create( adb, DB_NAME );

	return db;
};



/**
 * Creates a database if it does not exist
 *
 * @param adb 	ArangoDB database
 * @param name 	Name of the database to create
 * @returns 	ArangoDB database
 * @throws 		ArangoError
 *
 */
export const adb_db_create = async ( adb: Database, name: string ): Promise<Database> => {
	if ( !adb ) return null;

	let db: Database;

	// list all databases
	const dbs = await adb.listDatabases();

	if ( dbs.includes( name ) ) {
		db = await adb.database( name );
	} else {
		db = await adb.createDatabase( name );
		await db.exists();
	}

	// console.error( "===== DB IS NOW: ", db );

	_check_default_analyzers( db );

	return db;
};

/**
 * Drops a database
 *
 * @param adb 	ArangoDB database
 * @param name 	Name of the database to drop
 * @returns 	True if the database was dropped, false otherwise
 * @throws 		ArangoError
 */
export const adb_db_drop = async ( adb: Database, name: string ): Promise<boolean> => {
	let res = false;

	try {
		await adb.dropDatabase( name );
		res = true;
	} catch ( e ) {
		// console.error( "ERROR: ", e );
		// throw ( e );
	}

	return res;
};

/**
 * Creates a collection if it does not exist
 *
 * @param db 		ArangoDB database
 * @param name 		Name of the collection to create
 * @param options 	Options
 *
 * @returns 		ArangoDB collection
 * @throws 			ArangoError
 *
 */
export const adb_collection_create = async ( db: Database, name: string, options: DBCollectionCreateOptions = null ): Promise<any> => {
	if ( !db ) return null;
	let coll;

	if ( options?.drop ) {
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

/**
 * Drops a collection
 *
 * @param db 	ArangoDB database
 * @param name 	Name of the collection to drop
 *
 * @returns 	True if the collection was dropped, false otherwise
 */
export const adb_collection_drop = async ( db: Database, name: string ): Promise<boolean> => {
	const s = `FOR el IN ${ name } REMOVE el IN ${ name }`;
	await db.query( s );
	return true;
};

/**
 * Adds / updates an element in the collection
 *
 * @param db      	ArangoDB database
 * @param coll_name	Name of the collection
 * @param data    	Element data (key/val)
 * @param data_type	If present, element is filtered before returning
 *
 * @note - The update only works if the element has an _id field (the original Arango unique field)
 */
export const adb_record_add = async ( db: Database, coll_name: string, data: any, data_type?: any ): Promise<any> => {
	if ( !db ) return null;

	let res: any;
	let x: any;
	const d = new Date();
	const coll = _collection_get( db, coll_name );

	data.updated = d;
	try {
		if ( data._id ) {
			res = await coll.update( data._id, data, { returnNew: true } );
		} else {
			data.created = d;
			res = await coll.save( data, { returnNew: true } );
		}
	} catch ( e ) {
		error( "ADB ERROR: ", e.message, data );
		return null;
	}

	if ( res.new && res.new._key )
		x = res.new;
	else
		x = res;

	if ( data_type ) keys_filter( x, data_type );

	return x;
};

/**
 * Replaces an element in the collection
 *
 * @param db      	ArangoDB database
 * @param coll_name	Name of the collection
 * @param data    	Element data (key/val)
 * @param data_type	If present, element is filtered before returning
 *
 * @note - The update only works if the element has an _id field (the original Arango unique field)
 */
export const adb_record_replace = async ( db: Database, coll_name: string, data: any, data_type?: any ): Promise<any> => {
	if ( !db ) return null;

	let res: any;
	let x: any;
	const d = new Date();
	const coll = _collection_get( db, coll_name );

	data.updated = d;
	if ( data._id ) {
		res = await coll.replace( data._id, data, { returnNew: true } );
	} else {
		data.created = d;
		res = await coll.save( data, { returnNew: true } );
	}

	if ( res.new && res.new._key )
		x = res.new;
	else
		x = res;

	if ( data_type ) keys_filter( x, data_type );

	return x;
};


/**
 * Adds / updates a list of elements in the collection
 *
 * @param coll    	The collection to add the element to
 * @param data    	Element data (key/val)
 * @param data_type	If present, element is filtered before returning
 */
export const adb_record_add_all = async ( db: Database, coll_name: string, data: any ): Promise<any> => {
	let res: any;
	const coll = _collection_get( db, coll_name );

	data.forEach( ( e: any ) => {
		const d = new Date();
		if ( !e.created ) e.created = d;
		e.updated = d;
	} );

	res = await coll.saveAll( data, { returnNew: true } );

	return res;
};

/**
 * Query the database using AQL
 *
 * @param  db   - the database to query on
 * @param  query  - the AQL query
 * @param  params - a key/value pairs of params present in the query
 * @param  data_type - if present, result list will be filtered before returning
 * @param  options - Query options that change the behaviour of the query
 */
export const adb_query_all = async ( db: Database, query: string, params: any = undefined, data_type: any = undefined, options?: QueryOptions ): Promise<any> => {
	if ( !db ) return [];

	if ( options?.skip || options?.rows ) {
		// We have to modify the query so that it returns the correct number of rows
		const skip = options.skip || 0;
		const rows = options.rows || 25;

		// Before the RETURN statement, we add a LIMIT/SKIP statement
		const i = query.indexOf( "RETURN" );
		if ( i > 0 ) {
			query = query.slice( 0, i ) + `LIMIT ${ skip }, ${ rows }\n` + query.slice( i );
		}
	}

	if ( cfg.debug?.query_dump ) console.log( "AQL query: ", query, params );
	if ( !params ) params = {};

	try {
		const data: any = await db.query( query, params );
		const res: any[] = await data.all();

		if ( data_type ) res.forEach( ( el ) => keys_filter( el, data_type ) );

		if ( options?.count ) {
			const count = await adb_query_count( db, query, params );

			res.forEach( ( el ) => el.__count = count );
		}

		return res;
	} catch ( e ) {
		error( e.message );
		return [];
	}
};

/**
 * returns a single element
 *
 * @param  db   - the database to query on
 * @param  query  - the AQL query
 * @param  params - a key/value pairs of params present in the query
 * @param  data_type - if present, result list will be filtered before returning
 */
export const adb_query_one = async ( db: Database, query: string, params: any = undefined, data_type: any = undefined ): Promise<any> => {
	return new Promise( async ( resolve, reject ) => {
		const res = await adb_query_all( db, query, params, data_type );

		if ( !res || !res.length ) return resolve( null );

		return resolve( res[ 0 ] );
	} );
};

/**
 * In `query` just put 'FOR ... IN ....' and FILTERs  (no RETURN)
 */
export const adb_query_count = async ( db: Database, query: string, params: any = undefined ): Promise<number> => {
	// remove the LIMIT from query string
	const q = query.replace( /\s+LIMIT\s+[0-9]+,\s*[0-9]+/i, "" );

	// replace endlines with spaces
	const q2 = q.replace( /\n|\r/g, " " );

	// remove from RETURN { to end of text (multi line)
	const q3 = q2.replace( /\s+RETURN\s+.*/, "" );

	return new Promise( async ( resolve, reject ) => {
		query = `${ q3 } COLLECT WITH COUNT INTO length  RETURN length`;
		const res = await adb_query_one( db, query, params );

		if ( res === null ) return resolve( 0 );

		return resolve( res );
	} );
};

/**
 * Creates a collection in the database setting the indexes
 *
 * @param db 		ArangoDB database
 * @param name 		Name of the collection
 * @param idx 		Indexes to create
 * @param options 	Options to create the collection
 *
 * @returns 		The collection
 */
export const adb_collection_init = async ( db: Database, name: string, idx: DBCollectionIndex[] = null, options: DBCollectionCreateOptions = null ) => {
	if ( !db ) return null;

	const coll = await adb_collection_create( db, name, options );
	const ft_fields: any = {};

	if ( idx && idx.length ) {
		await Promise.all( idx.map( async ( p ) => {
			const fields = p.fields.join( '_' ).replace( "[*]", "" );
			p.name = `idx_${ name }_${ fields }`;
			// console.log( "NAME: ", p.name );

			if ( p.type != 'fulltext' ) {
				try {
					await coll.ensureIndex( p );
				} catch ( e ) {
					console.error( "ERROR CREATING INDEX: ", p.name );
				}
			}

			// TODO: fulltext indexes need much more love ;-)
			if ( p.type == 'fulltext' ) ft_fields[ fields ] = { "analyzers": [ "norm_it", "identity" ], "includeAllFields": false, "storeValues": "none", "trackListPositions": false };
		} ) );
	}

	// If the collection has fulltext indexes, we need to create a special view
	if ( Object.keys( ft_fields ).length ) {
		const view_opts: any = {  //ArangoSearchViewPropertiesOptions = {
			"writebufferIdle": 64,
			"writebufferSizeMax": 33554432,
			"consolidationPolicy": {
				"type": "tier",
				"segmentsBytesFloor": 2097152,
				"segmentsBytesMax": 5368709120,
				"segmentsMax": 10,
				"segmentsMin": 1,
				"minScore": 0
			},
			"writebufferActive": 0,
			"consolidationIntervalMsec": 1000,
			"cleanupIntervalStep": 2,
			"commitIntervalMsec": 1000,
			"primarySortCompression": "lz4"
		};

		const links = { [ name ]: { "analyzers": [ "identity" ], fields: ft_fields } };
		view_opts.links = links;
		const v_name = `v_${ name }`;
		const views = await db.listViews();

		if ( !views.find( ( v ) => v.name == v_name ) )
			await db.createView( `v_${ name }`, view_opts );
	}

	return coll;
};

/**
 * Create filters and pagination (if skip and rows are defined)
 *
 * If rows == -1, then all rows are returned
 *
 * This accepts two type of key/values
 *
 * - "just"  a key/value
 * - a value that is an object with the following keys:
 *     - val:    the value to match against
 *     - mode:   the arango DB comparsion mode
 *     - name:   the field name to match on
 *
 * NOTE: in 'mode' == 'multi' or 'm'  the inner search filter is used
 *
 * Returns [filters, values]
 */
export const adb_prepare_filters = ( prefix: string, data: any, extra_values?: any ) => {
	if ( !extra_values ) extra_values = {};

	const my_data = { ...data };
	const values: any = { ...extra_values };
	const filters: string[] = [];
	const searchers: string[] = [];
	const skip = my_data.skip || 0;
	const rows = my_data.rows || -1;

	delete my_data.skip;
	delete my_data.rows;

	const limit = rows != -1 ? ` LIMIT ${ skip }, ${ rows }` : '';

	Object.keys( my_data ).forEach( ( k: string ) => {
		let name: string;
		let mode = '==';
		let val;

		if ( typeof ( data[ k ] ) == 'undefined' ) return;
		if ( data[ k ] === null ) return;

		val = data[ k ];
		name = k;

		if ( val.mode ) {
			mode = val.mode;
			name = val.name || name;
			val = val.val || val.value;
		} else if ( Array.isArray( val ) ) {
			mode = 'a';
			val = val.filter( ( v ) => v !== null && v !== undefined && v.length );
		}

		if ( val !== undefined || mode == 'null' ) {
			values[ k ] = val;

			switch ( mode ) {
				case 'm':
				case 'multi':
				case 'in':
					delete values[ k ];
					const fields: string[] = val as any;

					// convert fields in a string starting with "[" and ending with "]"
					// and containing each element of the array separated by ","
					const fields_str = JSON.stringify( fields );

					filters.push( `FILTER ${ prefix }.${ name } IN ${ fields_str }` );
					break;
				case 'null':
					filters.push( `FILTER ${ prefix }.${ name } == null` );
					break;
				case 'ft':
				case 'fulltext':
					delete values[ k ];
					if ( val ) {
						searchers.push( `SEARCH ANALYZER(LIKE(${ prefix }.${ name }, "%${ val }%") OR LIKE(${ prefix }.${ name }, "%${ val }%" ), "norm_it")` );
					}
					break;
				case 'a':
					delete values[ k ];
					val.forEach( ( v: any ) => {
						if ( !v?.length ) return;
						filters.push( `FILTER '${ v }' IN ${ prefix }.${ name }` );
					} );
					// }
					break;

				default:
					filters.push( `FILTER ${ prefix }.${ name } ${ mode } @${ name }` );
			}
		}
	} );

	return [ [ ...searchers, ...filters ].join( '\n    ' ) + limit, values ];
};


/**
 * Counts the number of documents in a collection
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 */
export const adb_count = async ( db: Database, coll_name: string, data: any ) => {
	const [ filters, values ] = adb_prepare_filters( 'o', data );

	const count = await adb_query_count( db, `\n  FOR o IN  ${ coll_name }\n  ${ filters }\n  RETURN o`, values );

	return count;
};


/**
 * returns a list of elements
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 * @param data_type - if present, result list will be filtered before returning
 * @param options	- A `CollectionFindAllOptions` object
 */
export const adb_find_all = async ( db: Database, coll_name: string, data: any, data_type: any = undefined, options?: CollectionFindAllOptions ) => {  //rows = 0, skip = 0 ) => {
	const [ filters, values ] = adb_prepare_filters( 'o', data );
	let limit = '';
	let { skip = 0, rows = 0 } = options || {};
	const _sort: string[] = [];
	let sort = "";

	if ( skip && !rows ) rows = skip + 9999999;

	options?.sort && options.sort.forEach( ( opt: SortOptions ) => {
		if ( opt.desc )
			_sort.push( `o.${ opt.field } DESC` );
		else
			_sort.push( `o.${ opt.field }` );
	} );

	if ( _sort.length )
		sort = `SORT ${ _sort.join( ', ' ) }`;

	if ( rows > 0 )
		limit = `LIMIT ${ skip }, ${ rows }`;

	return await adb_query_all( db, `\n  FOR o IN ${ coll_name }\n  ${ sort } ${ filters } ${ limit } \n  RETURN o`, values, data_type, { count: options?.count } );
};

/**
 * returns a single element based on a dict
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 * @param data_type - if present, result list will be filtered before returning
 *
 * @note: if no filter is specified, returns a warning and returns null
 */
export const adb_find_one = async ( db: Database, coll_name: string, data: any, data_type: any = undefined ) => {
	const [ filters, values ] = adb_prepare_filters( 'o', data );

	if ( !filters ) {
		// write a warning in console and return null
		console.warn( `WARN: adb_find_one: no filters found for collection ${ coll_name }` );
		return null;
	}

	return await adb_query_one( db, `FOR o IN ${ coll_name } ${ filters } RETURN o`, values, data_type );
};

/**
 * removes one element from a collection
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 */
export const adb_del_one = async ( db: Database, coll_name: string, data: any ) => {
	const r = await adb_find_one( db, coll_name, data );
	if ( !r ) return;
	const coll: DocumentCollection = db.collection( coll_name );
	if ( !coll ) return;

	await coll.remove( r._id );
};

/**
 * removes all elements from a collection
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 *
 * @returns a list of removed elements ids
 */
export const adb_del_all = async ( db: Database, coll_name: string, data: any ) => {
	const r: any[] = await adb_find_all( db, coll_name, data );
	if ( !r?.length ) return [];

	return await adb_del_all_raw( db, coll_name, r );
};

export const adb_del_all_raw = async ( db: Database, coll_name: string, elems: any[] ) => {
	const coll: DocumentCollection = db.collection( coll_name );
	if ( !coll ) return [];

	const ids: string[] = elems.map( ( el ) => el.id );

	await Promise.all( elems.map( ( el ) => coll.remove( el._id ) ) );

	return ids;
};