import { ILRequest, ILResponse } from "./types";

// var chalk = require( 'chalk' );

interface DefenderSettings {
	/** Drop suspicious request if maxAttempts reached */
	dropSuspiciousRequest: boolean;

	/** If specified, we store logs in this file */
	logFile: string;

	/** If specified, we store logs in this file */
	maxAttempts: number;

	/** Console logging */
	consoleLogging: boolean;

	/** How much time the IP will be blacklisted */
	blacklistTimeout: number;

	/** A callback(ipAddress, url) that is triggered once an attacker from an IP has reached the maximum number of attempts */
	onMaxAttemptsReached: ( ip_addr: string, url: string ) => void;
}

const settings: DefenderSettings = {
	dropSuspiciousRequest: false,
	logFile: null,
	maxAttempts: 5,
	consoleLogging: true,
	onMaxAttemptsReached: null,
	blacklistTimeout: 30000,
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

interface BlackListCandidate {
	ipAddress: string;
	attemptCount: number;
}

// Candidates to be put on blacklist: IP => AttemptCount association - once we reach maxAttempts for an IP, we block it
const blacklistCandidates: any = {};
const blacklistIPs: any = {};

export const applySettings = ( _settings: DefenderSettings ) => {
	if ( _settings.dropSuspiciousRequest !== undefined ) {
		settings.dropSuspiciousRequest = _settings.dropSuspiciousRequest;
	}

	if ( _settings.consoleLogging !== undefined ) {
		settings.consoleLogging = _settings.consoleLogging;
	}

	if ( _settings.onMaxAttemptsReached != undefined ) {
		settings.onMaxAttemptsReached = _settings.onMaxAttemptsReached;
	}

	if ( _settings.maxAttempts != undefined ) {
		settings.maxAttempts = _settings.maxAttempts;
	}

	if ( _settings.logFile != undefined ) {
		settings.logFile = _settings.logFile;
		// settings.fs = require( 'fs' );
		// this.fileAppender = this.fs.appendFile;
	}
};

const _readable_address = ( request: ILRequest ) => {
	if ( request.headers[ 'x-forwarded-for' ] ) {
		return request.headers[ 'x-forwarded-for' ] + ' (via ' + request.socket.remoteAddress + ')';
	}

	return request.socket.remoteAddress;
};

const _ip_limit_reached = ( ipAddress: string ): boolean => {
	let candidate: BlackListCandidate = blacklistCandidates[ ipAddress ];

	if ( !candidate ) {
		candidate = {
			ipAddress,
			attemptCount: 1
		};

		blacklistCandidates[ ipAddress ] = candidate;

		return ( settings.maxAttempts == 1 );
	}

	candidate.attemptCount += 1;

	if ( candidate.attemptCount == settings.maxAttempts )
		return true;

	return false;
};

const Defender = ( request: ILRequest, response: ILResponse, next: any ) => {
	let url = request.originalUrl;
	const ip = ( request.headers[ 'x-forwarded-for' ] ? request.headers[ 'x-forwarded-for' ][ 0 ] : null ) || request.socket.remoteAddress;

	console.log( "---- REQUEST URL: ", url, ip );

	const b_ip: Date = blacklistIPs[ ip ];
	if ( b_ip ) {
		const d: number = new Date().getTime();
		const diff = d - b_ip.getTime();
		console.warn( "IP Blacklisted: ", ip, b_ip, diff );

		if ( !settings.blacklistTimeout || settings.blacklistTimeout > diff ) {
			response.status( 403 ).send( 'IP is blacklisted' );
			return;
		}

		delete blacklistIPs[ ip ];
	}

	if ( !url ) {
		next();
		return;
	}

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
	const ip = ( request.headers[ 'x-forwarded-for' ] ? request.headers[ 'x-forwarded-for' ][ 0 ] : null ) || request.socket.remoteAddress;
	const thresholdReached = _ip_limit_reached( ip );

	if ( thresholdReached && settings.onMaxAttemptsReached != null ) {
		message = `${ message }, reached threshold (${ settings.maxAttempts })`;

		try {
			settings.onMaxAttemptsReached( ip, request.originalUrl );
		}
		catch ( error ) {
			// this.logEvent( 'warn', 'An error occurred while executing onMaxAttemptsReached callback: ' + error );
			console.log( 'warn', 'An error occurred while executing onMaxAttemptsReached callback: ' + error );
		}
	}

	// this.logEvent( 'warn', message );
	console.log( 'warn', message );

	// Add IP to blacklist
	if ( thresholdReached ) {
		blacklistIPs[ ip ] = new Date();
	}

	if ( thresholdReached && settings.dropSuspiciousRequest ) {
		// this.logEvent( 'warn', 'Dropping request ' + request.originalUrl + ' from ' + this.getHumanReadableAddress( request ) );
		console.log( 'warn', 'Dropping request ' + request.originalUrl + ' from ' + _readable_address( request ) );

		delete blacklistCandidates[ ip ];

		response.status( 403 ).send( 'Untrusted Request Detected' );
		return true;
	}

	return false;
};

export default Defender;