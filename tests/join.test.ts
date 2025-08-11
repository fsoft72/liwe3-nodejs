import { join } from 'path';
import * as a from '../db/arango';
import { mkid } from '../utils';

const cfg = {
	database: {
		type: "arangodb",
		dbname: 'TEST-JOIN',
		server: "http://localhost:8529",
		port: 27017,
		arangoVersion: 31203
	}
};

const COLL_USERS = 'users';
const COLL_PROFILES = 'profiles';
const COLL_CUSTOMERS = 'customers';


const factory = async () => {
	console.log( "=== START FACTORY" );

	const db = await a.adb_init( cfg as any );

	const users_coll = await a.adb_collection_create( db, COLL_USERS );
	const profiles_coll = await a.adb_collection_create( db, COLL_PROFILES );
	const customer_coll = await a.adb_collection_create( db, COLL_CUSTOMERS );

	const mario_id = mkid( 'user' );
	await a.adb_record_add( db, COLL_USERS, { id: mario_id, name: "Mario", lastname: "Rossi" } );
	await a.adb_record_add( db, COLL_PROFILES, { id: mkid( 'profile' ), id_user: mario_id, role: "admin", enabled: true } );

	const luigi_id = mkid( 'user' );
	await a.adb_record_add( db, COLL_USERS, { id: luigi_id, name: "Luigi", lastname: "Verdi" } );
	await a.adb_record_add( db, COLL_PROFILES, { id: mkid( 'profile' ), id_user: luigi_id, role: "user", enabled: true } );

	const marco_id = mkid( 'user' );
	await a.adb_record_add( db, COLL_USERS, { id: marco_id, name: "Marco", lastname: "Bianchi" } );
	await a.adb_record_add( db, COLL_PROFILES, { id: mkid( 'profile' ), id_user: marco_id, role: "user", enabled: false } );

	const paolo_id = mkid( 'user' );
	await a.adb_record_add( db, COLL_USERS, { id: paolo_id, name: "Paolo", lastname: "Neri" } );
	await a.adb_record_add( db, COLL_PROFILES, { id: mkid( 'profile' ), id_user: paolo_id, role: "user", enabled: true } );

	const lucia_id = mkid( 'user' );
	await a.adb_record_add( db, COLL_USERS, { id: lucia_id, name: "Lucia", lastname: "Gialli" } );
	await a.adb_record_add( db, COLL_PROFILES, { id: mkid( 'profile' ), id_user: lucia_id, role: "user", enabled: true } );

	await a.adb_record_add( db, COLL_CUSTOMERS, {
		id: mkid( 'customer' ),
		name: "Giovanni",
		lastname: "Rossini",
		id_agent: mario_id,
	} );
	await a.adb_record_add( db, COLL_CUSTOMERS, {
		id: mkid( 'customer' ),
		name: "Anna",
		lastname: "Bianchi",
		id_agent: luigi_id,
	} );
	await a.adb_record_add( db, COLL_CUSTOMERS, {
		id: mkid( 'customer' ),
		name: "Carlo",
		lastname: "Verdi",
		id_agent: mario_id,
	} );
	await a.adb_record_add( db, COLL_CUSTOMERS, {
		id: mkid( 'customer' ),
		name: "Elena",
		lastname: "Neri",
		id_agent: paolo_id,
	} );
	await a.adb_record_add( db, COLL_CUSTOMERS, {
		id: mkid( 'customer' ),
		name: "Francesca",
		lastname: "Brancaleone",
		id_agent: marco_id,
	} );

	console.log( "=== END FACTORY" );

	console.log( "=== INIZIO TEST01" );
	const join_specs01 = [
		{
			coll_name: COLL_USERS,
			prefix: 'u',
			exclude: [ '_id', '_key', '_rev' ],
		},
		{
			coll_name: COLL_PROFILES,
			data: { enabled: true },
			prefix: 'p',
			join_condition: `u.id == p.id_user`,
			exclude: [ '_id', '_key', '_rev' ],
		}
	];
	const res01 = await a.adb_find_with_joins( db, join_specs01 );
	console.log( "=== FINE TEST01", res01 );

	console.log( "=== INIZIO TEST02" );
	/* It should return all customers with their agent and profile (mario, marco, luigi), but only those with enabled profile (marco is not enabled) */

	const join_specs02 = [
		{
			coll_name: COLL_CUSTOMERS,
			data: { id_agent: { mode: 'm', name: 'id_agent', val: [ mario_id, marco_id, luigi_id ] } },
			prefix: 'c',
			fields: [ 'name:cust_name', 'lastname:cust_lastname' ],
		},
		{
			coll_name: COLL_USERS,
			prefix: 'u',
			join_condition: `c.id_agent == u.id`,
		},
		{
			coll_name: COLL_PROFILES,
			data: { enabled: true },
			prefix: 'p',
			join_condition: `u.id == p.id_user`,
		}
	];
	const res02 = await a.adb_find_with_joins( db, join_specs02 );
	console.log( "=== FINE TEST02", res02 );
};

factory();
//test01();