import { config_load } from './liwe';
import { ILiweConfig, ILRequest, ILResponse, MiniUserDetails } from './types';
import { send_error } from './utils';

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

/**
 *  Verifies if the provided `user` has one of the perms specified by the `perms` string array.
 *
 * @param user   - The user
 * @param perms  - A string[] of perms
 */
export const perm_available = ( user: MiniUserDetails, perms: string[] ): boolean => {
	if ( !user ) return false;

	if ( cfg.debug?.auth_dump ) {
		console.log( "REQUIRED: ", perms );
		console.log( "USER %s PERMS: %o", user.email, user.perms );
	}

	// Special permissions: is-logged means the user has is own uid
	if ( perms.indexOf( "is-logged" ) !== -1 ) return true;

	// If the user has no perms, return false
	// if ( !user.perms || !Object.keys( user.perms ).length ) return false;
	if ( user?.perms.length === 0 ) return false;

	// Special permissions: system.admin can always do everything
	// if ( user.perms.system?.indexOf( "admin" ) >= 0 ) return true;
	if ( user.perms.indexOf( 'system.admin' ) >= 0 ) return true;

	let authorized = false;
	perms.map( ( p ) => {
		// we need just one permission to authorize
		if ( authorized ) return;

		authorized = user.perms.indexOf( p ) >= 0;
	} );

	if ( cfg.debug?.auth_dump )
		console.log( "AUTHORIZED: ", authorized );

	return authorized;
};

/**
 * Middleware function that checks if the user has the required permissions.
 * If the user does not have the required permissions, it sends a 403 Forbidden response.
 * If the `check_permissions` configuration option is disabled, it allows the request to proceed.
 * @param perms - An array of permission strings that the user must have.
 * @returns A middleware function that can be used in an Express.js route handler.
 */
export const perms = ( perms: string[] ) => {
	return ( req: ILRequest, res: ILResponse, next: any ) => {
		if ( cfg.debug?.auth_dump ) {
			console.log( "REQUESTED PERMS: ", perms );
			console.log( "REQ USER: ", req.user );
		}

		if ( !req.cfg?.security.check_permissions ) return next();

		if ( !req.user || !perm_available( req.user, perms ) )
			return send_error( res, { message: "not authorized" }, 403 );

		return next();
	};
};

/**
 * Checks if the user is logged in.
 * @param req - The request object.
 * @param res - The response object.
 */
export const is_logged = ( req: ILRequest, res: ILResponse ) => {
	if ( !req.user ) return send_error( res, { message: "not authorized" }, 403 );
};
