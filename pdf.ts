import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';

interface PDFMetaData {
	author?: string;
	title?: string;
	subject?: string;
	keywords?: string[];
	creator?: string;
	producer?: string;
	creationDate?: Date;
	modificationDate?: Date;
}


export const fillPDFForm = async ( inputPDFPath: string, outputPDFPath: string, data: Record<string, string>, meta?: PDFMetaData ) => {
	const pdfBytes = fs.readFileSync( inputPDFPath );
	const pdfDoc = await PDFDocument.load( pdfBytes );
	const form = pdfDoc.getForm();

	const keys = Object.keys( data );

	for ( const key of keys ) {
		const value = data[ key ];
		const field = form.getTextField( key );
		field.setText( value );
	}

	form.flatten();

	if ( meta ) {
		if ( meta.author ) pdfDoc.setAuthor( meta.author );
		if ( meta.title ) pdfDoc.setTitle( meta.title );
		if ( meta.subject ) pdfDoc.setSubject( meta.subject );
		if ( meta.keywords ) pdfDoc.setKeywords( meta.keywords );
		if ( meta.creator ) pdfDoc.setCreator( meta.creator );
		if ( meta.producer ) pdfDoc.setProducer( meta.producer );
		if ( meta.creationDate ) pdfDoc.setCreationDate( meta.creationDate );
		if ( meta.modificationDate ) pdfDoc.setModificationDate( meta.modificationDate );
	}

	const modifiedPdfBytes = await pdfDoc.save( { useObjectStreams: false } );

	fs.writeFileSync( outputPDFPath, modifiedPdfBytes );
};