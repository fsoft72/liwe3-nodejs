/**
 * LiWE3 Response Utilities
 *
 * This module provides standardized response formatting for all LiWE3 API endpoints.
 */

import * as express from 'express';

import { config_load } from './liwe';
import { ILiweConfig } from './types';

const cfg: ILiweConfig = config_load( 'data', {}, true, true );

/**
 * Standard error object format for LiWE3 responses
 */
export type LiWEError = {
  /** Error message describing what went wrong */
  message: string;
  /** Optional error code for programmatic handling */
  code?: string;
  /** Optional additional details about the error */
  level?: 'info' | 'warning' | 'error';
};

/**
 * Standard response format for all LiWE3 API endpoints
 * @template T - The type of data being returned
 */
export type LiWEResponse<T = any> = {
  /** Whether the operation was successful */
  ok: boolean;
  /** HTTP status code */
  status: number;
  /** Response data (omitted if null or undefined) */
  data?: T;
  /** Human-readable message (it will contain the error message if ok is false) */
  message?: string;
  /** Error details (only present when ok is false) */
  error?: LiWEError;
};

/**
 * Creates a standardized LiWE3 response object
 *
 * @template T - The type of data being returned
 * @param error - Error object (null/undefined for success)
 * @param data - Response data (omitted if null/undefined)
 * @param status - HTTP status code (defaults to 200)
 * @returns Standardized response object
 *
 * @example
 * // Success with data
 * createResponse(null, userData)
 * // Returns: { status: 200, data: User, ok: true }
 *
 * @example
 * // Success without data
 * createResponse()
 * // Returns: { status: 200, ok: true }
 *
 * @example
 * // Error case
 * createResponse({message: "User not found", code: "USER_NOT_FOUND"}, null, 404)
 * // Returns: { status: 404, error: {...}, message: "User not found", ok: false }
 */
export const createResponse = <T = any> ( error?: LiWEError, data?: T, status = 200 ): LiWEResponse<T> => {
  const response: LiWEResponse<T> = {
    status,
    ok: !error
  };

  // Only include data field if data is provided and not null/undefined
  if ( data !== undefined && data !== null ) {
    response.data = data;
  }

  // Only include error field if error exists
  if ( error ) {
    response.error = error;
    response.message = error.message;
  }

  return response;
};

/**
 * Helper function to create a success response
 *
 * @template T - The type of data being returned
 * @param data - Response data
 * @param status - HTTP status code (defaults to 200)
 * @returns Success response object
 */
export const responseSuccess = <T = any> ( data?: T, status = 200 ): LiWEResponse<T> => {
  return createResponse<T>( undefined, data, status );
};

/**
 * Helper function to create an error response
 *
 * @template T - The type of data being returned
 * @param message - Error message
 * @param code - Optional error code
 * @param status - HTTP status code (defaults to 400)
 * @returns Error response object
 */
export const responseError = <T = any> ( message: string, code?: string, status = 400 ): LiWEResponse<T> => {
  return createResponse<T>( { message, code }, undefined, status );
};

/**
 * This function is used when an Express request succedees
 *
 * @param res the express.Response
 * @param payload the reply payload that will be confìverted in JSON
 * @param status_code the return status code
 *
 */
export const sendResponse = ( res: express.Response, payload: LiWEResponse ): void => {
  if ( payload.ok && cfg.features.trace_ok ) {
    console.log( "%s\n==============================================================================\n\n", JSON.stringify( payload.data, null, 4 ) );
  }

  if ( payload.ok === false && cfg.features.trace_error ) {
    console.log( "%s\n==============================================================================\n\n", JSON.stringify( payload.error, null, 4 ) );
  }

  res.status( payload.status ).json( payload );
};

export const sendParametersError = ( res: express.Response, params: string[] ): void => {
  const errorMessage = `Invalid parameters: ${ params.join( ', ' ) }`;
  const response = responseError( errorMessage, 'LIWE3_INVALID_PARAMS' );
  sendResponse( res, response );
};
