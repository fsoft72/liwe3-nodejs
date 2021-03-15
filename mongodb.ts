/*
USE like this:

const MySchema = new Schema ({
	json_field: JSONType,
});

*/
export const JSONType = {
	type: String,
	trim: true,

	get ( data: any )
	{
		if ( ! data ) return {};
		try {
			return JSON.parse ( data );
		} catch ( err ) {
			console.error ( "JSONType get error: ", err );
			return data;
		}
	},

	set ( data: any )
	{
		return JSON.stringify ( data );
	}
};

/**
 * Check if the specified ``lst``  build of Mongoose Objects (with the ``_id`` field)
 * contains the ``obj`` with the ``_id`` field as well.
 *
 * Returns TRUE if the list `lst` contains a reference to `obj`
 *
 * SEE ALSO: mongoose_raw_includes () for raw data
 */
export const mongoose_include = ( lst: any, obj: any ): boolean =>
{
	if ( ! lst ) return false;
	if ( ! obj ) return false;

	const id = obj._id.toString ();

	return ( lst.filter ( ( el: any ) => el._id.toString () === id ).length > 0 );
};

export const mongoose_remove = ( lst: any, obj: any ): void =>
{
	if ( ! obj ) return;
	const id = obj._id.toString ();

	lst.pull ( id );
};

/**
 * Check if the specified ``lst``  of ObjectIds
 * contains the ``id`` specified.
 *
 * Returns TRUE if the list `lst` contains a reference to `obj`
 *
 * SEE ALSO: mongoose_raw_includes () for raw data
 */
export const mongoose_raw_includes = ( lst: any, id: any ): boolean =>
{
	if ( ! lst ) return false;

	id = id.toString ();

	return ( lst.filter ( ( el: any ) => el.toString () === id ).length > 0 );
};

export const mongoose_raw_remove = ( lst: any, id: any ): void =>
{
	if ( ! lst ) return;

	id = id.toString ();

	lst.pull ( id );
};

export const is_equal_id = ( id1: any, id2: any ): boolean =>
{
	const _id1 = ( id1._id ? id1._id : id1 ).toString ();
	const _id2 = ( id2._id ? id2._id : id2 ).toString ();

	return _id1 === _id2;
};
