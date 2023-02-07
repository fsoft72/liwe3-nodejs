/**
 * Recursively compares two objects and returns an object with the differences.
 *
 * @param {Object} obj1
 * @param {Object} obj2
 *
 * @returns {Object} Differences between the two objects.
 */
export const diff = ( obj1: any, obj2: any ) => {
	const differences: any = {};
	for ( const key in obj1 ) {
		if ( !obj2.hasOwnProperty( key ) ) {
			differences[ key ] = { type: 'delete' };
			continue;
		}
		if ( typeof obj1[ key ] === 'object' && typeof obj2[ key ] === 'object' ) {
			const nestedDifferences = diff( obj1[ key ], obj2[ key ] );
			if ( Object.keys( nestedDifferences ).length > 0 ) {
				differences[ key ] = { type: 'update', differences: nestedDifferences };
			}
		} else if ( obj1[ key ] !== obj2[ key ] ) {
			differences[ key ] = { type: 'update', value: obj2[ key ] };
		}
	}
	for ( const key in obj2 ) {
		if ( !obj1.hasOwnProperty( key ) ) {
			differences[ key ] = { type: 'add', value: obj2[ key ] };
		}
	}
	return differences;
};

/**
 * Applies the differences to the first object and returns the new object.
 *
 * @param {Object} obj1
 * @param {Object} differences created by compareObjects()
 *
 * @returns {Object} New object with the differences applied.
 */
export const patch = ( obj1: any, differences: any ) => {
	const obj2 = JSON.parse( JSON.stringify( obj1 ) );
	for ( const key in differences ) {
		switch ( differences[ key ].type ) {
			case 'add':
				obj2[ key ] = differences[ key ].value;
				break;
			case 'update':
				if ( typeof obj2[ key ] === 'object' ) {
					obj2[ key ] = patch( obj2[ key ], differences[ key ].differences );
				} else {
					obj2[ key ] = differences[ key ].value;
				}
				break;
			case 'delete':
				delete obj2[ key ];
				break;
		}
	}
	return obj2;
}

/*
// TEST
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
// compare the two objects and create a differences object
const diff = diffObjects( obj1, obj2 );
console.log( JSON.stringify( diff, null, 2 ) );
// apply the differences to the first object and create a new object (that should be equal to obj2)
const obj3 = applyDifferences( obj1, diff );
// compare obj2 and obj3 to make sure they are equal
console.log( "=== COMPARE: ", JSON.stringify( diffObjects( obj2, obj3 ), null, 2 ) );
*/