import { Database } from "arangojs";
import { DocumentCollection } from "arangojs/collection";
import { Analyzer } from "arangojs/analyzer";

import { config_load } from "./liwe";
import { ILiweConfig } from "./types";
import { keys_filter, unique_code } from "./utils";
import { ArangoSearchViewPropertiesOptions } from "arangojs/view";

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

export interface QueryOptions {
	/** If T, the query will return also the count of documents */
	count?: boolean;
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

export const arango_init = async ( cfg: any ): Promise<Database> => {
	const adb = new Database();
	await adb.exists();

	return adb;
};

const _check_default_analyzers = async ( db: Database ) => {
	const analyzers = [ 'norm_it', 'norm_en' ];

	await Promise.all( analyzers.map( async ( name ) => {
		const analyzer = db.analyzer( name );
		if ( !analyzer || ! await analyzer.exists() ) {
			console.log( `  -- DB: Analyzer ${ name } MISSING` );

			const locale = name == 'norm_en' ? 'en.utf-8' : 'it.utf-8';

			analyzer.create( { type: 'norm', properties: { locale, accent: false, case: "lower" } } );
		}
	} ) );
};

export const database_create = async ( adb: Database, name: string ): Promise<Database> => {
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

export const database_drop = async ( adb: Database, name: string ): Promise<boolean> => {
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

export const collection_create = async ( db: Database, name: string, options: DBCollectionCreateOptions = null ): Promise<any> => {
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

export const collection_truncate = async ( db: Database, name: string ): Promise<boolean> => {
	const s = `FOR el IN ${ name } REMOVE el IN ${ name }`;
	await db.query( s );
	return true;
};

/**
 * Adds / updates an element in the collection
 *
 * @param coll    	The collection to add the element to
 * @param data    	Element data (key/val)
 * @param force_insert 	Boolean, if T the element is forced to be inside the DB
 * @param data_type	If present, element is filtered before returning
 */
export const collection_add = async ( coll: DocumentCollection, data: any, force_insert: boolean = false, data_type: any = undefined ): Promise<any> => {
	let res: any;
	let x: any;

	data.updated = new Date();
	if ( !force_insert && data._id ) {
		res = await coll.update( data._id, data, { returnNew: true } );
	} else {
		data.created = new Date();
		res = await coll.save( data, { returnNew: true } );
	}

	if ( res.new && res.new._key )
		x = res.new;
	else
		x = res;

	if ( data_type ) keys_filter( x, data_type );

	return x;
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

/**
 * returns a list of elements
 *
 * @param  db   - the database to query on
 * @param  query  - the AQL query
 * @param  params - a key/value pairs of params present in the query
 * @param  data_type - if present, result list will be filtered before returning
 * @param  options - Query options that change the behaviour of the query
 */
export const collection_find_all = async ( db: Database, query: string, params: any = undefined, data_type: any = undefined, options?: QueryOptions ): Promise<any> => {
	if ( cfg.debug?.query_dump ) console.log( "AQL query: ", query, params );
	if ( !params ) params = {};

	const data: any = await db.query( query, params );
	const res: any[] = await data.all();

	if ( data_type ) res.forEach( ( el ) => keys_filter( el, data_type ) );

	if ( options?.count ) {
		const count = await collection_count( db, query, params );

		res.forEach( ( el ) => el.__count = count );
	}

	return res;
};

/**
 * returns a single element
 *
 * @param  db   - the database to query on
 * @param  query  - the AQL query
 * @param  params - a key/value pairs of params present in the query
 * @param  data_type - if present, result list will be filtered before returning
 */
export const collection_find_one = async ( db: Database, query: string, params: any = undefined, data_type: any = undefined ): Promise<any> => {
	return new Promise( async ( resolve, reject ) => {
		const res = await collection_find_all( db, query, params, data_type );

		if ( !res || !res.length ) return resolve( null );

		return resolve( res[ 0 ] );
	} );
};

export const collection_find_by_id = async ( coll: DocumentCollection, _id: string ): Promise<any> => {
	console.warn( "DEPRECATED: collection_find_by_id, use collection_find_one_dict()" );
	try {
		const res = await coll.document( _id );
		return res;
	} catch ( e ) {
		console.error( "Document with ID: %s not found", _id );
		return null;
	}
};

/**
 * In `query` just put 'FOR ... IN ....' and FILTERs  (no RETURN)
 */
export const collection_count = async ( db: Database, query: string, params: any = undefined ): Promise<number> => {
	// remove the LIMIT from query string
	const q = query.replace( /\s+LIMIT\s+[0-9]+,\s*[0-9]+/i, "" );

	// replace endlines with spaces
	const q2 = q.replace( /\n|\r/g, " " );

	// remove from RETURN { to end of text (multi line)
	const q3 = q2.replace( /\s+RETURN\s+\{.*/, "" );

	return new Promise( async ( resolve, reject ) => {
		query = `${ q3 } COLLECT WITH COUNT INTO length  RETURN length`;
		const res = await collection_find_one( db, query, params );

		if ( res === null ) return resolve( 0 );

		return resolve( res );
	} );
};

export const collection_init = async ( db: Database, name: string, idx: DBCollectionIndex[] = null, options: DBCollectionCreateOptions = null ) => {
	const coll = await collection_create( db, name, options );
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

		if ( Array.isArray( val ) ) {
			mode = 'a';
			name = k;
			val = val.filter( ( v ) => v !== null && v !== undefined && v.length );
		} else if ( typeof ( val ) == 'object' ) {
			mode = val.mode;
			name = val.name || k;
			val = val.val;
		} else {
			name = k;
		}

		if ( val !== undefined || mode == 'null' ) {
			values[ k ] = val;

			switch ( mode ) {
				case 'm':
				case 'multi':
					filters.push( `FILTER @${ k } IN ${ prefix }.${ name }` );
					break;
				case 'null':
					filters.push( `FILTER ${ prefix }.${ name } == null` );
					break;
				case 'ft':
				case 'fulltext':
					break;
				case 'a':
					delete values[ k ];
					// console.log( "\n\n\n======= ", { prefix, name, val, mode } );

					// FIXME: this is a MEGA PATCH  (tags search is different from other "IN" searches)
					/*
					if ( name != 'tags' ) {
						if ( val.length ) {
							filters.push( `FILTER ${ prefix }.${ name } IN ${ JSON.stringify( val ) }` );
						}
					} else {
						*/
					val.forEach( ( v: any ) => {
						if ( !v?.length ) return;
						filters.push( `FILTER '${ v }' IN ${ prefix }.${ k }` );
					} );
					// }
					break;

				default:
					filters.push( `FILTER ${ prefix }.${ name } ${ mode } @${ k }` );
			}
		}
	} );

	return [ filters.join( '\n    ' ) + limit, values ];
};

export const mkid = ( prefix: string ) => {
	return unique_code( false, prefix );
};


interface SortOptions {
	field: string;
	desc?: number;
}

interface CollectionFindAllOptions {
	rows?: number;
	skip?: number;
	sort?: SortOptions[];
}

/**
 * returns a list of elements
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 * @param  data_type - if present, result list will be filtered before returning
 * @param options	- A `CollectionFindAllOptions` object
 */
export const collection_find_all_dict = async ( db: Database, coll_name: string, data: any, data_type: any = undefined, options?: CollectionFindAllOptions ) => {  //rows = 0, skip = 0 ) => {
	const [ filters, values ] = prepare_filters( 'o', data );
	let limit = '';
	let { skip = 0, rows = 0 } = options || {};
	const _sort: string[] = [];
	let sort = "";

	if ( skip && !rows ) rows = 9999999;

	if ( rows > 0 )
		limit = `LIMIT ${ skip }, ${ rows }`;

	options?.sort && options.sort.forEach( ( opt: SortOptions ) => {
		if ( opt.desc )
			_sort.push( `o.${ opt.field } DESC` );
		else
			_sort.push( `o.${ opt.field }` );
	} );

	if ( _sort.length )
		sort = `SORT ${ _sort.join( ', ' ) }`;

	return await collection_find_all( db, `\n  FOR o IN ${ coll_name }\n    ${ filters } ${ sort } ${ limit }\n  RETURN o`, values, data_type );
};

/**
 * returns a single element based on a dict
 *
 * @param db          the database to query onto
 * @param coll_name   the collection name
 * @param data        the data to filter on (key/val)
 * @param  data_type - if present, result list will be filtered before returning
 */
export const collection_find_one_dict = async ( db: Database, coll_name: string, data: any, data_type: any = undefined ) => {
	const [ filters, values ] = prepare_filters( 'o', data );

	return await collection_find_one( db, `FOR o IN ${ coll_name } ${ filters } RETURN o`, values, data_type );
};

export const collection_del_one_dict = async ( db: Database, coll_name: string, data: any ) => {
	const r = await collection_find_one_dict( db, coll_name, data );
	if ( !r ) return;
	const coll: DocumentCollection = db.collection( coll_name );
	if ( !coll ) return;

	await coll.remove( r._id );
};

export const collection_del_all_dict = async ( db: Database, coll_name: string, data: any ) => {
	const r: any[] = await collection_find_all_dict( db, coll_name, data );
	if ( !r?.length ) return;

	const coll: DocumentCollection = db.collection( coll_name );
	if ( !coll ) return;

	await Promise.all( r.map( ( el ) => coll.remove( el._id ) ) );

	return;
};