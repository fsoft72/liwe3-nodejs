import { get_real_ip } from "./defender";
import { ILRequest, ILResponse } from "./types";

interface ThrottlerSettings {
	/** How much time should pass between requests (in millis) */
	requestInterval: number;

	/** How much time a request should be put on hold */
	waitTime: number;

	/** How many requests before throttling */
	requestCount: number;
}

let settings: ThrottlerSettings = {
	requestInterval: 10,
	waitTime: 100,
	requestCount: 5
};

interface RequestInfo {
	date: Date;
}

const _requests_info: any = {};

/**
 * Changes Throttler's settings
 */
export const applySettings = ( _settings: ThrottlerSettings ) => {
	settings = { ...settings, ..._settings };
};

const _ip_request_limit_reached = ( ipAddress: string ): boolean => {
	let requests: RequestInfo[] = _requests_info[ ipAddress ];
	const req_info: RequestInfo = {
		date: new Date( new Date().getTime() + settings.requestInterval )
	};

	if ( !requests ) {
		_requests_info[ ipAddress ] = [ req_info ];

		return false;
	}

	const now = new Date();
	requests = requests.filter( ( req ) => req.date > now );
	requests.push( req_info );

	_requests_info[ ipAddress ] = requests;

	if ( requests.length >= settings.requestCount )
		return true;

	return false;
};

/**
 * Throttles incoming requests based on IP address.
 * If the IP address has reached the request limit, it delays the request before passing it to the next middleware.
 *
 * @param request - The incoming request object.
 * @param response - The outgoing response object.
 * @param next - The next middleware function.
 */
const Throttler = ( request: ILRequest, response: ILResponse, next: any ) => {
	const ip = get_real_ip( request );

	if ( _ip_request_limit_reached( ip ) ) {
		console.log( "Throttling request" );
		setTimeout( () => next(), settings.waitTime );
		return;
	}

	next();
};

export default Throttler;