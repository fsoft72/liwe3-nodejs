import { cryptPayload, decryptPayload } from '../crypt_messages';

describe( 'crypting and decrypting', () => {

	it( 'hello world as string', () => {
		const enc = cryptPayload( 'hello world' );
		const dec = decryptPayload( enc );

		expect( dec ).not.toBeNull();
		expect( dec ).toBe( 'hello world' );
	} );

	it( '123 as number', () => {
		const enc = cryptPayload( 123 );
		const dec = decryptPayload( enc );

		expect( dec ).not.toBeNull();
		expect( dec ).toBe( 123 );
	} );

	it( 'null value', () => {
		const enc = cryptPayload( null );
		const dec = decryptPayload( enc );

		expect( dec ).toBeNull();
	} );

	it( 'hello world object', () => {
		const enc = cryptPayload( { hello: 'world' } );
		const dec = decryptPayload( enc );

		expect( dec ).not.toBeNull();
		expect( dec.hello ).toBe( 'world' );
	} );

	it( 'complex object', () => {
		const enc = cryptPayload( { hello: 'world', num: 123, arr: [ 1, 2, 3 ], obj: { a: 1, b: 2 } } );
		const dec = decryptPayload( enc );

		expect( dec ).not.toBeNull();
		expect( dec.hello ).toBe( 'world' );
		expect( dec.num ).toBe( 123 );
		expect( dec.arr ).toEqual( [ 1, 2, 3 ] );
		expect( dec.obj ).toEqual( { a: 1, b: 2 } );
	} );

} );
