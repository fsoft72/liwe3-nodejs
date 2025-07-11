import { S3FileClassConfig, S3FileManager } from '../s3filemanager';

const cfg: S3FileClassConfig = {
	region: 'eu-central-1',
	bucketName: 'os3.test',
	accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
	secretAccessKey: process.env.AWS_SECRET
};

const exec = async () => {
	const s3 = new S3FileManager( cfg );

	await s3.mkdir( 'test-dir' );
	console.log( 'DIR: ', await s3.ls( 'test-dir' ) );
	await s3.rm( 'test-dir/prova.png' );
	console.log( 'DIR: ', await s3.ls( 'test-dir' ) );
	await s3.uploadFile( 'test-dir/prova.png', '/ramdisk/prova.png' );
	const url = await s3.getSignedDownloadUrl( 'test-dir/prova.png', 60 );

	console.log( 'Download URL:', url );

	console.log( '=== GET: ', await s3.getFile( 'test-dir/prova.png', '/ramdisk/pizza.png' ) );

	await s3.rmdir( 'test-dir' );


};

exec();