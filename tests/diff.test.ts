import { diff, patch } from '../diff';

const obj1 = {
	id: 1,
	name: 'John Doe',
	address: {
		street: '123 Main St',
		city: 'New York',
		state: 'NY',
	},
	job: {
		title: 'Developer',
		company: 'Acme Inc',
		section: {
			name: 'Section 1',
			employees: [ 'John', 'Jane', 'Bob' ],
		}
	},
	hobbies: [ 'movies', 'music', { "hello": "me" } ],
};

const obj2 = {
	id: 1,
	name: 'John Doe',
	address: {
		street: '123 Main St',
		city: 'New York',
		state: 'NY',
	},
	job: {
		title: 'Developer',
		company: 'The Company Inc',		// changed
		section: {
			name: 'The Section 1',		// changed
			employees: [ 'John', 'Jane', 'Bob', 'Jim' ],  // added Jim
		}
	},
	// hobbies: [ 'movies', 'music', { "hello": "me" } ],  // removed
	new: 'new',	// added
};

describe( 'diff and patch', () => {
	let delta: any;
	let obj3: any;

	it( 'should return the delta diff', () => {
		// compare the two objects and create a differences object
		delta = diff( obj1, obj2 );
		console.log( JSON.stringify( delta, null, 2 ) );
	} );

	it( 'should apply the delta diff', () => {
		// apply the differences to the first object and create a new object (that should be equal to obj2)
		obj3 = patch( obj1, delta );
		// compare obj2 and obj3 to make sure they are equal
		expect( obj2 ).toEqual( obj3 );
	} );

	it( 'should return empty delta diff', () => {
		expect( diff( obj2, obj3 ) ).toEqual( {} );
	} );
} );