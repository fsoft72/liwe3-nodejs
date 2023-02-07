import { md5, sha512, unique_code, mkid, random_string } from '../utils';

describe( 'hashing function', () => {
	it( 'should return valid md5', () => {
		const res = '5eb63bbbe01eeed093cb22bb8f5acdc3';

		expect( md5( 'hello world' ) ).toEqual( res );
	} );

	it( 'should return valid sha512', () => {
		const res = '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f';

		expect( sha512( 'hello world' ) ).toEqual( res );
	} );

	it( 'should return the same sha512', () => {
		const res = '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f';

		expect( sha512( res, true ) ).toEqual( res );
	} );
} );

describe( 'ids and unique codes', () => {
	it( 'should return the smallest unique code', () => {
		const res = unique_code( true, null, false );

		expect( res.length ).toEqual( 8 );
	} );

	it( 'should return a 37 chars unique code', () => {
		const res = unique_code( false, null, false );

		expect( res.length ).toEqual( 37 );
	} );

	it( 'should return a unique code starting with prefix', () => {
		const res = unique_code( false, 'prefix', false );

		expect( res.length ).toEqual( 44 );
		expect( res.startsWith( 'prefix' ) ).toBeTruthy();
	} );

	it( 'should return a unique code starting with prefix and a second slice', () => {
		const res = unique_code( false, 'prefix', true );

		expect( res.length ).toEqual( 44 );
		expect( res.startsWith( 'prefix' ) ).toBeTruthy();
		expect( res.split( '.' ).slice( -1 )[ 0 ].length ).toEqual( 4 );
	} );

	it( 'should return an unique id starting with "ciao"', () => {
		const res = mkid( 'ciao' );

		expect( res.length ).toEqual( 42 );
		expect( res.startsWith( 'ciao' ) ).toBeTruthy();
	} );

	it( 'should return an unique id starting with "ciao" and ending with "png"', () => {
		const res = mkid( 'ciao', 'png' );

		expect( res.length ).toEqual( 46 );
		expect( res.startsWith( 'ciao' ) ).toBeTruthy();
		expect( res.endsWith( '.png' ) ).toBeTruthy();
	} );

	it( 'should return a random string of 6 characters', () => {
		const res = random_string( 6 );

		expect( res.length ).toEqual( 6 );
	} );

	it( 'should return a random string of 6 numbers only', () => {
		const res = random_string( 6, 20, true );

		expect( res.length ).toEqual( 6 );
		expect( res ).toMatch( /^[0-9]+$/ );
	} );
} );