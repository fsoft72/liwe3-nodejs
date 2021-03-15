var og_parser = require ( "og-parser" );

export const parser = ( url : string, cback : ( err: any, result ?: IUrlParsed ) => {} ) => {
	return og_parser ( url, cback );
};

export interface IUrlParsed
{
	link: string;
	title: string;
	description: string;
	thumb: string;
	error ?: string;
}

export const parse_video = ( url : string, cback: ( err : any, result ?: IUrlParsed ) => void ) => {
	og_parser ( url, ( err : any, data : any ) =>
	{
		if ( err ) return cback ? cback ( err ) : err;

		const og = data.og;
		const res : IUrlParsed = {
			link: '',
			thumb: '',
			description: '',
			title: ''
		};

		switch ( og.site_name )
		{
			case "YouTube":
				res.title = og.title;
				res.description = og.description;
				res.thumb = og.image.url;
				res.link =  "youtube:" + og.image.url.replace ( /.*\/vi\/([^/]*)\/.*/, "$1" ); 
				break;

			case "Vimeo":
				res.title = og.title;
				res.description = og.description;
				res.thumb = og.image.url;

				res.thumb = res.thumb.replace ( /.*src0=(.*)&src1.*/, "$1" ).replace ( /%3A/g, ":" ).replace ( /%2F/g, "/" );
				res.link  = "vimeo:" + og.url.replace ( /.*vimeo.com\/([^/]*)/, "$1" );
				break;

			default:
				res.error = "Unknown source: " + og.site_name;
		}

		return cback ? cback ( null, res ) : res;
	} );
};
