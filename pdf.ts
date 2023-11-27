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

/*
<html>
  <head>
	<meta charset="utf-8" />
	<script src="https://unpkg.com/pdf-lib@1.4.0"></script>
	<script src="https://unpkg.com/downloadjs@1.4.7"></script>
  </head>

  <body>
	<p>Click the button to create a new PDF document with <code>pdf-lib</code></p>
	<button onclick="createPdf()">Create PDF</button>
	<p class="small">(Your browser will download the resulting file)</p>
  </body>

  <script>
	const { PDFDocument, StandardFonts, rgb } = PDFLib

	async function createPdf() {
	  // Create a new PDFDocument
	  const pdfDoc = await PDFDocument.create()

	  // Embed the Times Roman font
	  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)

	  // Add a blank page to the document
	  const page = pdfDoc.addPage()

	  // Get the width and height of the page
	  const { width, height } = page.getSize();

	  const margin_x = 0;
	  const margin_y = 0;

	  function getX(x) { return margin_x + x; };
	  function getY(y) { return height - margin_y - y; };

	  function text(txt, x, y) {
			page.drawText ( txt, {
			x: getX(x),
		  y: getY(y + ((fontSize/4)*3)),
		 size: fontSize,
		font: timesRomanFont,
		color: rgb(0, 0.53, 0.71),

		})
	  }

			function line(x1, y1, x2, y2, thickness ) {

			// y1 += ( thickness / 2);


			page.drawLine ({
			start: { x: getX(x1), y: getY(y1) },
		  end: { x: getX(x2), y: getY(y2) },
		  thickness: thickness,
			color: rgb(0.75, 0.2, 0.2),
  opacity: 0.75,

		})
	  }

	  // Draw a string of text toward the top of the page
	  const fontSize = 14;


	  text('Creating PDFs in JavaScript is awesome!', 0, 0 );
	  line(0, 0, width, 0, 2);


	  // Serialize the PDFDocument to bytes (a Uint8Array)
	  const pdfBytes = await pdfDoc.save()

			// Trigger the browser to download the PDF document
	  download(pdfBytes, "pdf-lib_creation_example.pdf", "application/pdf");
	}
  </script>
</html>
*/