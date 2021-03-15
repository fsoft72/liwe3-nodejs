/** @ignore *//** */

import axios, { AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';

interface IData {
	action: string;
}

interface IParams {
	url?: string;
	ok?: any;
	err?: any;
}

/**
 *
 * @param {string action
 * @param {IData} data
 * @param {IParams} params - Valid values are:
 * 				- url:   the request url
 * 				- ok:    the function to be called if request ok
 * 				- err:   the function to be called if request is on error
 */
const ajax = ( action: string, data: IData, params: IParams ): Promise<any> => {
	const url = params.url || 'http://localhost:8000/ajax.pyhp';

	data.action = action;
	axios.defaults.withCredentials = true;

	const cfg: AxiosRequestConfig = { headers: { "Content-Type": 'application/json' } };

	return axios.post( url, data, cfg )
		.then( ( r: AxiosResponse ) => {
			if ( r && !r.data )
				throw Error( "No valid response from server" );

			if ( r && r.data && r.data.err_code )
				throw [ { description: r.data.err_descr, code: r.data.err_code, module_name: 'liwe' } ];

			if ( r && r.data && r.data.errors && r.data.errors.length )
				throw r.data.errors;

			if ( params.ok ) params.ok( r.data.response );
			return r.data.response;
		}, ( error: AxiosError ) => {
			console.error( "REQUEST Error: " + error );
			if ( params.err ) params.err( error );
			throw error;
		} );
};

// export default ajax;
module.exports.default = ajax;
