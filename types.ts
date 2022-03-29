import * as express from 'express';
// import { SocketIORouter } from './socketio';

/** MiniUserDetails */
export interface MiniUserDetails {
	/** The user id */
	id?: string;
	/** The domain id the user belongs to */
	id_domain?: string;
	/** The user email */
	email?: string;
	/** The user first name */
	name?: string;
	/** The user last name */
	lastname?: string;
	/** All user permissions */
	perms?: any;
	/** The user level */
	level?: number;
	/** Extra items for user details (jsoninzed) */
	extra?: any;
	/** Tags added to the user */
	tags?: string[];
	/** The user avatar URL */
	avatar?: string;

	/** The unique session key */
	session_key?: string;
}


/** Options you can pass on a Server start */
export interface LiWEServerOptions {
	/** Use this option to FORCE server port number. By default, server port is defined by env.PORT or data.json */
	port?: number;

	/** Not used yet */
	log?: boolean;
}

/** The standard LiWE Callback for functions. */
export type LCback = ( err: any, arg1?: any ) => void;

interface LiWESession {
	id_domain?: string;
	domain_code?: string;
	data?: {
		user?: MiniUserDetails;
	};
}

/** The enhanced Request with LiWE elements */
export interface ILRequest extends express.Request {
	/** The user structure, if the user is logged */
	user?: MiniUserDetails;

	/** The full user session */
	session?: LiWESession;

	/** The current language (for localization) */
	language?: string;

	/** The file upload object */
	file: any;

	/** The LiWE Config structure */
	cfg?: ILiweConfig;

	/** the main connection to db */
	db?: any;

	/** The Response */
	res: ILResponse;

	/** The localization function */
	$l?: ( key: string, val: object, plural: boolean, module: string ) => string;

	/** The instance of the SocketIORouter (if enabled) */
	// socketio?: SocketIORouter;

	fields?: any;

	files?: any;

	logout: () => void;
}

/** A simple redefinition of express.Response */
export type ILResponse = express.Response & {
	send: any;
};

/** Extended express.Application */
export interface ILApplication extends express.Application {
	/** The database connection (if any) */
	db?: any;

	/** Istance of the SocketIO Router */
	// socket?: SocketIORouter;
}

/** A simple redefinition of express.NextFunction */
export type ILNextFunction = express.NextFunction;

/** The standard LiWE Frameword Error structure */
export interface ILError {
	/** The error name */
	name?: string;
	/** Error message */
	message: string;
	/** Error stack trace */
	stack?: string;
}

/** A simple utility that returns `true` or `false` if the parameter is true, "true" or '1'
 *
 * @param v   the parameter to convert to boolean
 *
 * @returns the boolean obtained by parsing the `v` parameter
 */
export const toBoolean = ( v: any ) => {
	v = v.toString();

	if ( v === 'true' || v === '1' ) return true;

	return false;
};

export interface ILiWE {
	app: ILApplication;
	cfg: ILiweConfig;
	cwd: string;
	app_name: string;
	port: number;
	db: any;
	module_init: ( name: string ) => void | null;
}

export interface ILiWEDefaultUser {
	email: string;
	password: string;
	name?: string;
	lastname?: string;
	enabled?: boolean;
}

interface ILiWEStartupConf {
	/** array of modules to bootstrap at the beginning */
	modules: string[];
}

export interface ILiweConfig {
	app: {
		name: string;
		default_language: string;

		/** list of supported languages eg. [ "en", "it" ] */
		languages: string[];

		/** It T, the app returns domains in some points */
		return_domains: boolean;

		/** The default domain name */
		domain: string;

		/** Configurations for the app startup */
		startup: ILiWEStartupConf;
	};

	debug: {
		/** If T, debug is enabled */
		enabled: boolean;

		/** If T, user code (for registration and similar) are sent with the call */
		send_code: boolean;

		/** If T, query are dumped on console */
		query_dump: boolean;

		/** If T, auth perms are dumped on console */
		auth_dump: boolean;
	};

	/** The server configuration section */
	server: {
		/** Server listen port */
		port: number;
		/** The real url of the server */
		url: string;
		public_url: string;
		public_name: string;
		public_dir: string;
		max_post_size: number;
		dump_ip: boolean;
	};

	/** The TUS server for file uploads */
	tus: {
		/** Server listen port */
		port: number;

		/** TUS Secret */
		secret: string;
	};

	upload: {
		max_upload_size: number;
		temp_dir: string;
		sizes: {
			thumb: number;
			small: number;
			medium: number;
			large: number;
		};
	};
	security: {
		secret: string;
		enable_cookie: boolean;
		cookie: string;

		/** The unique key used to challenge remote public requests */
		remote: string;

		enable_token: boolean;
		header: string;
		param_name: string;

		token_expires: number;

		auth_token: string[];

		check_permissions: boolean;

		defender: {
			enabled: boolean;
			drop_requests: boolean;
			max_attempts: number;
			blacklist_timeout: number;
			suspicious_timeout: number;
			parse_fragments: boolean;
		};

		throttler: {
			/** Flag T/F to enable / disable throttler */
			enabled: boolean;
			/** Number of request before throttling */
			request_count: number;
			/** Time in millis before each request */
			request_interval: number;
			/** Throttle time in millis */
			wait_time: number;
		};

		session: {
			/** Flag T/F. It T, the session is IP bounded */
			bind_ip: boolean;
			/** If True, only a session per user login at a time is available */
			single: boolean;
		};

	};

	database: {
		type: "arangodb" | "mongodb";
		dbname: string;
		server: string;
		port: number;
	};

	auth: {
		local: boolean;
		jwt: boolean;
		facebook: {
			app_id: string;
			app_secret: string;
		};
		code_length: number;
		success: string;
		failure: string;
	};

	smtp: {
		protocol: string;
		server: string;
		port: number;
		login: string;
		password: string;
		dump_on_console: boolean;
		send_for_real: boolean;
		from: string;
	};

	user: {
		auto_enabled: boolean;
		auth_code_length: number;
		auth_code_forced: string | boolean;
		auth_code_debug: boolean;
		activate_and_login: boolean;
		jwt_dump: boolean;
		debug: boolean;
		users: ILiWEDefaultUser[];
		otl_new_on_login: boolean;
		otl_keep_the_same: boolean;
		secure_passwords: boolean;
		password: {
			enforce: boolean;
			min_len: number;
			secure: boolean;
		};

		/** The recaptcha section */
		recaptcha: {
			/** Flag T/F to check for recaptcha */
			enabled: boolean;

			/** The hCaptcha secret key */
			secret: string;
		};
	};

	features: {
		reactions: boolean;
		trace: boolean;
		trace_ok: boolean;
		friend: boolean;
		tags: boolean;
		passport: boolean;
		jwt: boolean;
		curl: boolean;
		curl_filename: string;
		curl_single_user: boolean;
		restest: boolean;
		restest_filename: string;
		restest_single_user: boolean;
		ssl: boolean;
		location: boolean;
		socketio: boolean;
		socketio_debug: boolean;
	};

	warns: any;
}
