import * as express from 'express';
// import { SocketIORouter } from './socketio';

/** Options you can pass on a Server start */
export interface LiWEServerOptions {
	/** Use this option to FORCE server port number. By default, server port is defined by env.PORT or data.json */
	port?: number;

	/** Not used yet */
	log?: boolean;
}

/** The standard LiWE Callback for functions. */
export type LCback = ( err: any, arg1?: any ) => void;

/** The enhanced Fastify Request with LiWE elements */
export interface ILRequest extends express.Request {
	/** The user structure, if the user is logged */
	user?: any;
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

	/** The instance of the SocketIORouter (if enabled) */
	// socketio?: SocketIORouter;

	logout: () => void;
}

/** A simple redefinition of express.Response */
export type ILResponse = express.Response & {
	send: any;
};

/** Extended express.Application */
export interface ILApplication extends express.Application {
	/** The database connection (if any) */
	db?: any; // The Database Connection
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
	cfg: any;
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

export interface ILiweConfig {
	app: {
		name: string;
		default_language: string;
		debug: boolean;
	};
	server: {
		port: number;
		url: string;
		public_url: string;
		public_name: string;
		use_domains: boolean;
		return_domains: boolean;
		domain: string;
		public_dir: string;
		max_post_size: number;
		dump_ip: boolean;
	};
	upload: {
		max_upload_size: number;
		temp_dir: string;
	};
	security: {
		secret: string;
		enable_cookie: boolean;
		cookie: string;

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
		login: string;
		password: string;
		dump_on_console: boolean;
		send_for_real: boolean;
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
