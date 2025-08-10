import { z } from 'zod';
import { LiWEResponse, responseError } from './response';

export type FieldMeta = { priv?: boolean; };

const META = new WeakMap<z.ZodTypeAny, FieldMeta>();

export function zodMeta<T extends z.ZodTypeAny> ( schema: T, meta: FieldMeta ): T {
	META.set( schema, meta );
	return schema;
}

export function getMeta ( schema: z.ZodTypeAny ): FieldMeta | undefined {
	return META.get( schema );
}

// Debug helpers (enable with DEBUG_ZOD_UNWRAP=1)
const DEBUG_ZOD_UNWRAP = process.env.DEBUG_ZOD_UNWRAP === '1';
const dbg = ( ...args: any[] ) => { if ( DEBUG_ZOD_UNWRAP ) console.debug( '[liwe/zod.unwrapSchema]', ...args ); };
const schemaInfo = ( s: any ) => `ctor=${ s?.constructor?.name ?? 'unknown' } typeName=${ s?._def?.typeName ?? 'unknown' }`;
// Normalize typename for safer comparisons
const getTypeName = ( s: any, def?: any ) => {
	return ( def?.typeName ?? s?._def?.typeName ?? s?.constructor?.name ?? 'unknown' ) + '';
};
// Minimal guard to detect actual Zod schemas
const isZodSchema = ( x: any ): x is z.ZodTypeAny =>
	!!x && typeof x === 'object' && typeof x.safeParse === 'function';

function unwrapSchema ( s: z.ZodTypeAny ): z.ZodTypeAny {
	// Early guard: nullish -> log; primitives -> silent
	if ( s == null ) {
		dbg( 'Received nullish schema:', s );
		if ( DEBUG_ZOD_UNWRAP ) console.trace( 'unwrapSchema call trace' );
		return s as any;
	}
	if ( typeof s !== 'object' ) {
		// Primitives like "array" can leak here from external callers; ignore quietly.
		return s as any;
	}

	const def: any = ( s as any )?._def;

	// Missing _def: log and bail out
	if ( !def ) {
		dbg( 'Schema has no _def:', schemaInfo( s ) );
		if ( DEBUG_ZOD_UNWRAP ) console.trace( 'unwrapSchema call trace (no _def)' );
		return s;
	}

	if ( s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault ) {
		// Some Zod versions use .innerType, others .inner or .type
		const inner = def.innerType || def.inner || def.type;
		if ( !isZodSchema( inner ) ) {
			dbg( 'Wrapper schema without valid inner type:', schemaInfo( s ), { defKeys: Object.keys( def ?? {} ) } );
			return s;
		}
		return unwrapSchema( inner );
	}

	// Support Zod effects with safer detection
	const isZodEffects = () => {
		// Prefer constructor check when available
		const ZodEffectsCtor = ( z as any ).ZodEffects;
		if ( ZodEffectsCtor && s instanceof ZodEffectsCtor ) return true;

		// Compare normalized typeName
		const Kind: any = ( z as any ).ZodFirstPartyTypeKind;
		const typeName = getTypeName( s, def );
		if ( typeName === Kind?.ZodEffects || typeName === 'ZodEffects' ) return true;

		// Only consider as effects if both effect and schema exist
		return !!def?.effect && !!def?.schema;
	};

	if ( isZodEffects() ) {
		if ( !def.schema ) {
			// Treat as non-effects to avoid false positives/noisy logs
			dbg( 'Detected effects-like schema without def.schema; treating as non-effects:', schemaInfo( s ), { defKeys: Object.keys( def ?? {} ) } );
			return s;
		}
		dbg( 'Unwrapping ZodEffects:', schemaInfo( def.schema ) );
		return unwrapSchema( def.schema );
	}

	return s;
}

function typeString ( s: z.ZodTypeAny ): string {
	// Avoid noisy unwrap when not a schema (e.g., accidental strings like "array")
	if ( !isZodSchema( s ) ) return 'any';

	const u = unwrapSchema( s );
	if ( u instanceof z.ZodString ) return 'string';
	if ( u instanceof z.ZodNumber ) return 'number';
	if ( u instanceof z.ZodBoolean ) return 'boolean';
	if ( u instanceof z.ZodArray ) {
		const inner = ( u as any )?._def?.type as unknown;
		if ( !isZodSchema( inner ) ) {
			dbg( 'ZodArray inner is not a schema:', schemaInfo( u ), { innerType: typeof inner } );
			return 'any[]';
		}
		return `${ typeString( inner ) }[]`;
	}
	if ( u instanceof z.ZodDate ) return 'Date';
	if ( u instanceof z.ZodObject ) return 'object';
	return 'any';
}

function getShape ( obj: z.ZodObject<any> ) {
	// Support both .shape and ._def.shape()
	const anyObj: any = obj as any;
	return anyObj.shape ?? anyObj._def?.shape?.();
}

export function zodKeys ( obj: z.ZodObject<any> ) {
	const shape = getShape( obj ) as Record<string, z.ZodTypeAny>;
	const out: Record<string, { type: string; priv: boolean; }> = {};

	for ( const [ key, schema ] of Object.entries( shape ) ) {
		const meta = getMeta( schema );
		out[ key ] = {
			type: typeString( schema ),
			priv: Boolean( meta?.priv ),
		};
	}

	return out;
}

// Generic params validator: returns parsed data with optional ___errors on success or failure
export function zodParams<S extends z.ZodTypeAny> (
	schema: S,
	obj: unknown
): z.infer<S> & { ___errors?: LiWEResponse; } {
	const parsed = schema.safeParse( obj );

	if ( !parsed.success ) {
		const _errors = parsed.error.issues.map( ( i ) => `${ i.path.join( '.' ) }: ${ i.message }` );
		return { ___errors: responseError( `Parameters error: ${ _errors.join( ', ' ) }`, "L.ERR001", "error", 400 ) } as z.infer<S> & { ___errors: LiWEResponse; };
	}

	// Ensure the success shape always contains ___errors for convenient destructuring
	return { ...( parsed.data as unknown as Record<string, unknown> ), ___errors: undefined } as z.infer<S> & { ___errors?: LiWEResponse; };
}
