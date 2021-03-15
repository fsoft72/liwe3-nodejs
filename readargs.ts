interface IParsedToken {
	token: string;
	parsed: boolean;
}

interface IReadArgsArg {
	token?: string;
	name: string;
	is_switch: boolean;
	is_number: boolean;
	is_needed: boolean;
	is_multi: boolean;
	value: any;
	parsed: boolean;
}

export class ReadArgs {
	private _fields: any = {};
	private _ordered_fields: IReadArgsArg[] = [];
	private _multi_field: IReadArgsArg = null;

	public parse ( template: string, text: string ) {
		this._template( template );

		const txt = text.split( /[ ]+/ );
		const data: IReadArgsArg[] = [];

		txt.map( ( t ) => data.push( {
			token: t,
			parsed: false,
			is_multi: false,
			is_needed: false,
			is_number: false,
			is_switch: false,
			name: '',
			value: undefined
		} ) );

		this._parse_named( data );
		this._parse_switches( data );
		this._parse_needed( data );
		this._parse_remaining( data );
		this._parse_to_multi( data );
	}

	// tslint:disable-next-line: no-unnecessary-initializer
	public get ( field_name: string, default_val: any = undefined ) {
		const field = this._fields[ field_name.toUpperCase() ];

		if ( field.parsed ) return field.value;

		return default_val;
	}

	public clear () {
		this._fields = {};
		this._ordered_fields = [];
		this._multi_field = null;
	}

	/*
	 * Example:
	 *
	 * 	COMMAND/A, FILE/M, SELECTABLE/S, ARG1, ANUM/N
	 */
	/** @ignore */
	private _template ( description: string ) {
		this.clear();

		const txt = description.toUpperCase().split( /[ ,]+/ );
		txt.map( ( elem: string ) => {
			this._field_add( elem );
		} );
	}

	private _field_add ( elem: string ) {
		const sw = elem.split( "/" );

		const data: IReadArgsArg = {
			name: sw[ 0 ],
			is_switch: false,
			is_number: false,
			is_needed: false,
			is_multi: false,
			value: undefined,
			parsed: false
		};

		sw.map( ( s: string ) => {
			switch ( s ) {
				case "A":
					data.is_needed = true;
					break;
				case "S":
					data.is_switch = true;
					break;
				case "M":
					data.is_multi = true;
					break;
				case "N":
					data.is_number = true;
					break;
			}
		} );

		this._fields[ data.name ] = data;
		this._ordered_fields.push( data );
		if ( data.is_multi ) this._multi_field = data;
	}

	private _parse_switches ( data: IReadArgsArg[] ) {
		this._ordered_fields.map( ( field: IReadArgsArg ) => {
			if ( !field.is_switch ) return;
			field.parsed = true;

			data.map( ( t ) => {
				const tok = t.token.toUpperCase();

				if ( tok === field.name ) {
					field.value = true;
					t.parsed = true;
				}
			} );
		} );
	}

	private _parse_named ( data: IReadArgsArg[] ) {
		data.map( ( tok ) => {
			if ( tok.parsed ) return;
			if ( tok.token.indexOf( "=" ) === -1 ) return;

			tok.parsed = true;
			const item: string[] | undefined = tok.token?.split( "=" );

			const field = this._fields[ item[ 0 ].toUpperCase() ];
			if ( !field ) {
				console.error( "Could not find argument: ", item[ 0 ] );
				return;
			}

			field.parsed = true;

			this._assign_value( field, item[ 1 ] );
		} );
	}

	private _assign_value ( field: IReadArgsArg, val: string ) {
		if ( field.is_multi ) {
			if ( field.value === undefined ) field.value = [];

			if ( field.is_number )
				field.value.push( parseInt( val, 10 ) );
			else
				field.value.push( val );
		} else if ( field.is_number ) {
			field.value = parseInt( val, 10 );
		} else
			field.value = val;
	}

	private _parse_needed ( data: IReadArgsArg[] ) {
		this._ordered_fields.map( ( field ) => {
			if ( !field.is_needed ) return;
			if ( field.parsed ) return;
			if ( field.value !== undefined ) return;

			const tok = this._token_get_first( data );

			if ( !tok ) return;

			field.parsed = true;

			this._assign_value( field, tok.token || '' );
		} );
	}

	private _parse_remaining ( data: IReadArgsArg[] ) {
		this._ordered_fields.map( ( field ) => {
			if ( field.parsed ) return;
			if ( field.value !== undefined ) return;

			const tok = this._token_get_first( data );

			if ( !tok ) return;

			field.parsed = true;

			this._assign_value( field, tok.token || '' );
		} );
	}

	private _token_get_first ( data: IReadArgsArg[] ): IReadArgsArg | null {
		let tok: IReadArgsArg | null = null;

		data.map( ( token ) => {
			if ( tok ) return;
			if ( token.parsed ) return;

			token.parsed = true;

			tok = token;
		} );

		return tok;
	}

	private _parse_to_multi ( data: IReadArgsArg[] ) {
		if ( !this._multi_field ) return;

		data.map( ( tok ) => {
			if ( tok.parsed ) return;
			tok.parsed = true;
			this._assign_value( this._multi_field, tok.token || '' );
		} );
	}
}
