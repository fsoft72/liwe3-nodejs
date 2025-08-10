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

function unwrapSchema ( s: z.ZodTypeAny ): z.ZodTypeAny {
	// Unwrap Optional, Nullable, Default, Effects when present
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const def: any = ( s as any )._def;
	if ( s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault ) {
		return unwrapSchema( def.innerType || def.inner || def.type );
	}
	if ( s instanceof z.ZodEffects ) {
		return unwrapSchema( def.schema );
	}
	return s;
}

function typeString ( s: z.ZodTypeAny ): string {
	const u = unwrapSchema( s );
	if ( u instanceof z.ZodString ) return 'string';
	if ( u instanceof z.ZodNumber ) return 'number';
	if ( u instanceof z.ZodBoolean ) return 'boolean';
	if ( u instanceof z.ZodArray ) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const inner = ( u as any )._def.type as z.ZodTypeAny;
		return `${ typeString( inner ) }[]`;
	}
	if ( u instanceof z.ZodDate ) return 'Date';
	if ( u instanceof z.ZodObject ) return 'object';
	return 'any';
}

function getShape ( obj: z.ZodObject<any> ) {
	// Support both .shape and ._def.shape()
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Generic params validator: returns parsed data on success, or { ___errors: string[] } on failure
export function zodParams<S extends z.ZodTypeAny> ( schema: S, obj: unknown ): z.infer<S> | { ___errors: LiWEResponse; } {
	const parsed = schema.safeParse( obj );

	if ( !parsed.success ) {
		const _errors = parsed.error.issues.map( ( i: z.ZodIssue ) => `${ i.path.join( '.' ) }: ${ i.message }` );
		return { ___errors: responseError( `Parameters error: ${ _errors.join( ', ' ) }`, "L.ERR001", 400 ) };
	}
	return parsed.data;
}
