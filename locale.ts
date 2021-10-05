import * as hb from "handlebars";
import * as fs from './fs';
import * as liwe from './liwe';
import { ILApplication, ILRequest, ILResponse } from './types';

interface ILocString {
	key?: string;
	single: string;
	plural?: string;
}

interface IModuleMap {
	[ key: string ]: ILocString;
}

interface IModuleLocaleMap {
	[ modname: string ]: IModuleMap;
}

interface ILangModuleMap {
	[ lang: string ]: IModuleLocaleMap;
}

interface ILocale {
	languages: ILangModuleMap;
	default: string;
}

interface IModuleLoad {
	language: string;
	module: string;
	messages: ILocString[];
}

class Locale implements ILocale {
	public languages: ILangModuleMap;
	public default: string;

	constructor () {
		this.languages = {};
		this.default = 'en';
	}

	public set_default_language ( lang: string ): void {
		if ( !lang ) lang = 'en';
		this.default = lang;
	}

	public set ( lang: string, key: string, single: string, plural: string, module: string = 'default' ): void {
		const m = this._get_module( lang, module );
		m[ key ] = { single, plural };
	}

	public set_multi ( lang: string, module: string, items: ILocString[] ): void {
		if ( !items || !items.length ) return;

		const m = this._get_module( lang, module );

		items.map( ( el ) => {
			if ( !el.plural ) el.plural = el.single;
			if ( !el.single ) el.single = el.plural;

			m[ el.key || '' ] = { single: el.single, plural: el.plural };
		} );
	}

	public dump () {
		console.log( this.toJSON() );
	}

	public toJSON () {
		return JSON.stringify( this.languages, null, 4 );
	}

	public best_language ( languages: string = "" ) {
		const keys = Object.keys( this.languages );
		let result = '';

		if ( !languages ) languages = this.default;

		// split on "," and " " chars and map results against localization strings
		// the first one that matches is the preferred
		languages.toLowerCase().split( /[, ]/ ).map( ( x ) => { x = x.split( ";" )[ 0 ]; x = x.split( "-" )[ 0 ]; return x.trim(); } ).filter( ( x ) => x.length ).map( ( l ) => {
			if ( result ) return;

			if ( keys.indexOf( l ) >= 0 ) result = l;
		} );

		if ( !result ) result = this.default;

		return result;
	}

	public translate ( lang: string, key: string, val: object, plural: boolean = false, module: string = 'default' ): string {
		const m = this._get_module( lang, module );
		let tmpl = m[ key ] ? m[ key ][ plural ? 'plural' : 'single' ] : key;

		if ( !tmpl ) tmpl = key;
		if ( !val ) val = {};

		const h = hb.compile( tmpl );
		return h( val );
	}

	private _get_module ( lang: string, module: string ): IModuleMap {
		if ( !this.languages[ lang ] ) this.languages[ lang ] = {};
		if ( !this.languages[ lang ][ module ] ) this.languages[ lang ][ module ] = {};

		return this.languages[ lang ][ module ];
	}
}

export const loc = new Locale();

const _loc_fn = ( req: ILRequest, res: ILResponse, next: any ) => {
	const l = loc.best_language( req.headers[ "accept-language" ] );

	req.$l = ( key: string, val: object, plural: boolean = false, module: string = 'default' ) => {
		return loc.translate( l, key, val, plural, module );
	};

	req.language = l;

	next();
};

export const $l = ( key: string, val: object, plural: boolean = false, module: string = 'default', lang: string = null ) => {
	if ( !lang ) lang = loc.default;

	return loc.translate( lang, key, val, plural, module );
};

/**
 * load a locale collection into the system
 *
 * @param  module   -  The module name (eg. 'user', 'system')
 * @param  language -  The language to load (eg. "it", "en", "es" )
 */
export const locale_load = ( module: string, language: string ) => {
	// const fname = fs.abspath ( `./locales/${module}/${language}.json` );
	const fname = liwe.fsname( `etc/locales/${ module }.${ language }.json` );
	let txt: string = fs.read( fname );

	if ( !txt || !txt.length )
		txt = "{}";
	else
		console.log( "        -- Loading: %s [%s]", module, language );

	const messages: ILocString[] = JSON.parse( txt );

	loc.set_multi( language, module, messages );
};

export const express_init = ( app: ILApplication ) => app.use( _loc_fn );
