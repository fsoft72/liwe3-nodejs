import * as fs from 'fs';

import { fsname, config_load } from './liwe';
import { LCback } from './types';
import { template_render } from './utils';

const cfg = config_load( 'data', {}, true, true );

/**
 * sends an email using settings from `cfg.smtp`
 *
 * @param subect Email subject
 * @param text  the email bdy in plain text
 * @param html  the body in HTML
 * @param to  destination user
 * @param from sender email
 * @param cback the cback to be called
 */
export const send_mail = ( subject: string, text: string, html: string, to: string, from: string, cback: LCback ) => {
	const { protocol, login, password, server, send_for_real, dump_on_console } = cfg.smtp;

	if ( !from ) from = login;

	const mailOptions = {
		from,
		to,
		subject,
		html,
		text
	};

	if ( dump_on_console )
		console.log( "mailOptions: ", mailOptions );

	if ( !send_for_real ) return cback( null, {} );

	const nodemailer = require( 'nodemailer' );
	const url = `${ protocol }://${ login }:${ password }@${ server }`;
	const transporter = nodemailer.createTransport( url );

	return transporter.sendMail( mailOptions, cback );
};

/**
 * sends an email using the `template` provided
 *
 * @param subect Email subject
 * @param template  the template string (in HandleBars format)
 * @param args  Arguments to be passed to the template composition
 * @param to  destination user
 * @param from sender email
 * @param cback the cback to be called
 *
 */
export const send_mail_template = ( subject: string, template: string, args: object, to: string, from: string, cback: LCback ) => {
	const html = template_render( template, args );
	const text = template_render( template.replace( ".html", ".txt" ), args );

	return send_mail( subject, text, html, to, from, ( err: any ) => {
		if ( err ) return cback && cback( err );

		return cback && cback( null, { subject, text, html, to, from } );
	} );
};

/**
 * sends an email using the `template` in the right locale (if available) or using the default locale
 *
 * @param module  the module name
 * @param template_filename  the name of the template (in etc/templates/modulename/template_filename)
 * @param language  the desired template language
 * @param subect Email subject
 * @param args  Arguments to be passed to the template composition
 * @param to  destination user
 * @param from sender email
 * @param cback the cback to be called
 *
 */
export const send_mail_template_locale = ( module: string, template_filename: string, language: string, subject: string, args: object, to: string, from: string, cback: LCback ) => {
	const fname = fsname( `etc/templates/${ module }` );
	let dname = '';

	const _send_all = ( dfname: string ) => {
		return send_mail_template( subject, dfname, args, to, from, cback );
	};

	if ( !fs.existsSync( fname ) ) return cback( { message: "Directory not found: " + fname } );

	dname = fname + `/${ template_filename }.${ language }.html`;
	if ( fs.existsSync( dname ) ) return _send_all( dname );

	dname = fname + `/${ template_filename }.en.html`;
	if ( fs.existsSync( dname ) ) return _send_all( dname );

	dname = fname + `/${ template_filename }.html`;
	if ( fs.existsSync( dname ) ) return _send_all( dname );

	// If we get here, there is no template available
	return cback( { message: 'Template not found: ', template_filename, dname } );
};
