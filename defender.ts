import { ILRequest, ILResponse } from "./types";

// var chalk = require( 'chalk' );

const _ip_re = /((\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5])))/;

const real_ip = ( ipAddr: string ) => {
	const g = ipAddr.match( _ip_re );

	return g[ 1 ];
};

export const get_real_ip = ( request: ILRequest ): string => {
	return real_ip( ( request.headers[ 'x-forwarded-for' ] ? request.headers[ 'x-forwarded-for' ][ 0 ] : null ) || request.socket.remoteAddress );
};

interface DefenderSettings {
	/** Drop suspicious request if maxAttempts reached */
	dropSuspiciousRequest: boolean;

	/** If specified, we store logs in this file */
	logFile?: string;

	/** If specified, we store logs in this file */
	maxAttempts: number;

	/** How much time the IP will be blacklisted */
	blacklistTimeout: number;

	/** How much time the suspicious request should count */
	suspiciousTimeout: number;

	/** If URL parsing should be run against fragments */
	parseFragments: boolean;

	/** A callback(ipAddress, url) that is triggered once an attacker from an IP has reached the maximum number of attempts */
	onMaxAttemptsReached?: ( ip_addr: string, url: string ) => void;
}

let settings: DefenderSettings = {
	dropSuspiciousRequest: false,
	logFile: null,
	maxAttempts: 5,
	onMaxAttemptsReached: null,
	blacklistTimeout: 30000,
	suspiciousTimeout: 500,
	parseFragments: true
};

interface SuspiciousFragment {
	category: string;
	patterns: string[];
}

const suspiciousUrlFragments = [
	{
		category: 'Path Traversal',
		patterns: [ '../', '.%00.', '..%01', '%5C..', '.%2e', '%2e.', '..\\',
			'/etc/hosts', '/etc/passwd', '/etc/shadow', '/etc/issue',
			'windows/system32/cmd.exe', 'windows\\system32\\cmd.exe', 'c+dir+c:\\', '\\windows\\system32\\drivers\\etc\\hosts', 'config.inc.php' ]
	},
	{
		category: 'Reflected XSS',
		patterns: [ '<script', '\\x3cscript', '%3cscript', 'alert(', 'onclick=', 'onerror=', 'onkeydown=', 'onkeypress=', 'onkeyup=', 'onmouseout=', 'onmouseover=',
			'onload=', 'document.cookie', '.addeventlistener', 'javascript:', 'jav&#x0D;ascript:', 'java\0script' ]
	},
	{
		category: 'SQL Injection',
		patterns: [ '\' or \'1\'=\'1', 'or \'x\'=\'x\'', 'or 1=1', '" or "1"="1', '" or ""=""', '\' or \'\'=\'\'', 'drop table', 'insert into' ]
	}
];

interface SuspiciousRequestInfo {
	ipAddress: string;
	date: Date;
}

// Candidates to be put on blacklist: IP => AttemptCount association - once we reach maxAttempts for an IP, we block it
const _suspicious_requests: any = {};
const _blacklist_ips: any = {};

/**
 * Add an IP address to blacklist
 *
 * Parameters:
 *
 * - ip_addr   - The IP to blacklist
 * - duration  - Time in millis of the blacklist
 */
export const blacklist_ip = ( ip_addr: string, duration: number ) => {
	var newDateObj = new Date( new Date().getTime() + duration );
	_blacklist_ips[ ip_addr ] = newDateObj;
};

export const blacklist_ip_list = () => {
	const ips: { ip: string, date: Date; }[] = [];

	Object.keys( _blacklist_ips ).forEach( ( ip: string ) => {
		ips.push( { ip, date: _blacklist_ips[ ip ] } );
	} );

	return ips;
};

/**
 * Changes Defender's settings
 */
export const applySettings = ( _settings: DefenderSettings ) => {
	settings = { ...settings, ..._settings };
};

const _readable_address = ( request: ILRequest ) => {
	if ( request.headers[ 'x-forwarded-for' ] ) {
		return request.headers[ 'x-forwarded-for' ] + ' (via ' + request.socket.remoteAddress + ')';
	}

	return request.socket.remoteAddress;
};

const _ip_limit_reached = ( ipAddress: string ): boolean => {
	let susp_reqs: SuspiciousRequestInfo[] = _suspicious_requests[ ipAddress ];
	const candidate: SuspiciousRequestInfo = {
		ipAddress,
		date: new Date( new Date().getTime() + settings.suspiciousTimeout )
	};

	if ( !susp_reqs ) {
		_suspicious_requests[ ipAddress ] = [ candidate ];

		return ( settings.maxAttempts == 1 );
	}

	const now = new Date();
	susp_reqs = susp_reqs.filter( ( req ) => req.date > now );
	susp_reqs.push( candidate );

	_suspicious_requests[ ipAddress ] = susp_reqs;

	if ( susp_reqs.length == settings.maxAttempts )
		return true;

	return false;
};

const Defender = ( request: ILRequest, response: ILResponse, next: any ) => {
	let url = request.originalUrl;
	const ip = get_real_ip( request );

	// console.log( "---- REQUEST URL: ", url, ip, settings );

	const b_ip: Date = _blacklist_ips[ ip ];
	if ( b_ip ) {
		const d: number = new Date().getTime();
		const diff = d - b_ip.getTime();

		console.warn( "IP Blacklisted: ", ip, b_ip, diff );

		if ( !settings.blacklistTimeout || diff < 0 ) {
			response.status( 403 ).send( 'IP is blacklisted' );
			return;
		}

		delete _blacklist_ips[ ip ];
	}

	if ( !url ) {
		next();
		return;
	}

	if ( settings.parseFragments ) {
		url = url.toLowerCase();

		suspiciousUrlFragments.forEach( ( fragment ) => {
			const category = fragment.category;
			const patterns = fragment.patterns;

			patterns.forEach( ( pattern ) => {
				pattern = pattern.toLowerCase();

				if ( url.indexOf( pattern ) != -1 || decodeURI( url ).indexOf( pattern ) != -1 ) {
					_handle_suspicious_request( request, response, next, category, pattern );
					return;
				}
			} );

		} );
	}

	next();
};

const _handle_suspicious_request = ( request: ILRequest, response: ILResponse, next: any, category: string, blacklistItem: string ) => {
	const message = `Suspicious Request ${ request.originalUrl }, fragment is on blacklist (${ category }): "${ blacklistItem }" from ${ _readable_address( request ) }`;

	// if returns `true`, activity has been blocked and we don't need
	// to call the next ()
	if ( add_suspicious_activity( request, response, message ) ) return;

	next();
};

/**
 * add a new suspicious activity to the log
 * if it returns `true`, it means that ip reached threshold
 */
export const add_suspicious_activity = ( request: ILRequest, response: ILResponse, message: string ): boolean => {
	const ip = get_real_ip( request );
	const thresholdReached = _ip_limit_reached( ip );

	if ( thresholdReached && settings.onMaxAttemptsReached != null ) {
		message = `${ message }, reached threshold (${ settings.maxAttempts })`;

		try {
			settings.onMaxAttemptsReached( ip, request.originalUrl );
		}
		catch ( error ) {
			// this.logEvent( 'warn', 'An error occurred while executing onMaxAttemptsReached callback: ' + error );
			console.warn( 'An error occurred while executing onMaxAttemptsReached callback: ' + error );
		}
	}

	// this.logEvent( 'warn', message );
	console.warn( message );

	// Add IP to blacklist
	if ( thresholdReached )
		blacklist_ip( ip, settings.blacklistTimeout );

	if ( thresholdReached && settings.dropSuspiciousRequest ) {
		// this.logEvent( 'warn', 'Dropping request ' + request.originalUrl + ' from ' + this.getHumanReadableAddress( request ) );
		console.warn( 'Dropping request ' + request.originalUrl + ' from ' + ip );

		delete _suspicious_requests[ ip ];

		response.status( 403 ).send( 'Untrusted Request Detected' );
		return true;
	}

	return false;
};

export default Defender;