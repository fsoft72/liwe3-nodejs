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

/**
 * Represents a locale with language modules for translation.
 */
class Locale implements ILocale {
	public languages: ILangModuleMap;
	public default: string;

	constructor () {
		this.languages = {};
		this.default = 'en';
	}

	/**
	 * Sets the default language for the locale.
	 * If no language is provided, 'en' (English) will be used as the default.
	 *
	 * @param lang - The language code to set as the default.
	 * @returns void
	 */
	public set_default_language ( lang: string ): void {
		if ( !lang ) lang = 'en';
		this.default = lang;
	}

	/**
	 * Sets the translation for a given language, key, single and plural values, and module.
	 * If the module is not specified, it defaults to 'default'.
	 * @param lang The language code.
	 * @param key The translation key.
	 * @param single The translation for the singular form.
	 * @param plural The translation for the plural form.
	 * @param module The module name (optional).
	 */
	public set ( lang: string, key: string, single: string, plural: string, module: string = 'default' ): void {
		const m = this._get_module( lang, module );
		m[ key ] = { single, plural };
	}

	/**
	 * Sets multiple localization strings for a specific language and module.
	 * @param lang The language code.
	 * @param module The module name.
	 * @param items An array of localization strings.
	 */
	public set_multi ( lang: string, module: string, items: ILocString[] ): void {
		if ( !items || !items.length ) return;

		const m = this._get_module( lang, module );

		items.map( ( el ) => {
			if ( !el.plural ) el.plural = el.single;
			if ( !el.single ) el.single = el.plural;

			m[ el.key || '' ] = { single: el.single, plural: el.plural };
		} );
	}

	/**
	 * Dumps the current state of the object to the console.
	 */
	public dump () {
		console.log( this.toJSON() );
	}

	/**
	 * Converts the languages object to a JSON string representation.
	 * @returns {string} The JSON string representation of the languages object.
	 */
	public toJSON () {
		return JSON.stringify( this.languages, null, 4 );
	}

	/**
	 * Finds the best language from the given list of languages.
	 * If no languages are provided, the default language is used.
	 * The best language is determined by matching the languages against the available localization strings.
	 * The first matching language is considered the preferred language.
	 * If no matching language is found, the default language is returned.
	 *
	 * @param languages - The list of languages to search for the best language.
	 * @returns The best language found or the default language if no match is found.
	 */
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

	/**
	 * Translates a given key into the specified language.
	 * @param lang The language code.
	 * @param key The translation key.
	 * @param val The values to be interpolated into the translation template.
	 * @param plural Indicates whether the translation is for plural form.
	 * @param module The translation module name.
	 * @returns The translated string.
	 */
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

/**
 * Translates a key using the specified language, module, and values.
 *
 * @param key - The key to be translated.
 * @param val - The values to be substituted in the translation.
 * @param plural - Indicates whether the translation is for plural form.
 * @param module - The module name for the translation.
 * @param lang - The language code for the translation. If not provided, the default language will be used.
 * @returns The translated string.
 */
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
