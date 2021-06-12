import { config_load } from './liwe';
import { ILiweConfig, ILRequest, ILResponse } from './types';
import { send_error } from './utils';

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

interface IUser {
	perms: any;
	email: string;
}

export const perm_available = ( user: IUser, perms: string[] ): boolean => {
	if ( !user ) return false;

	if ( cfg.debug?.auth_dump ) {
		console.log( "REQUIRED: ", perms );
		console.log( "USER %s PERMS: %o", user.email, user.perms );
	}

	// Special permissions: is-logged means the user has is own uid
	if ( perms.indexOf( "is-logged" ) !== -1 ) return true;

	if ( !user.perms || !Object.keys( user.perms ).length ) return false;

	// Special permissions: system.admin can always do everything
	if ( user.perms.system?.indexOf( "admin" ) >= 0 ) return true;

	let authorized = false;
	perms.map( ( p ) => {
		// we need just one permission to authorize
		if ( authorized ) return;

		const spl = p.split( "." );
		const mod = user.perms[ spl[ 0 ] ] || [];

		if ( mod.indexOf( 'admin' ) > -1 )
			authorized = true;
		else
			authorized = ( mod.indexOf( spl[ 1 ] ) > -1 );
	} );

	if ( cfg.debug?.auth_dump )
		console.log( "AUTHORIZED: ", authorized );

	return authorized;
};

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

export const is_logged = ( req: ILRequest, res: ILResponse ) => {
	if ( !req.user ) return send_error( res, { message: "not authorized" }, 403 );
};
