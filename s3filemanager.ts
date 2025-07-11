import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	ListObjectsV2Command,
	CopyObjectCommand,
	DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream'; // Explicitly import Readable for type assertion

// --- Interfaces ---

/**
 * Configuration interface for the S3FileManager class.
 */
export interface S3FileClassConfig {
	region: string;
	bucketName: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

/**
 * Interface for an entry returned by the 'ls' method, representing a file or directory in S3.
 */
export interface S3LsEntry {
	name: string; // The base name of the file or directory.
	type: 'file' | 'directory'; // The type of the entry.
	fullPath: string; // The full S3 key (path + name).
	size?: number; // Size in bytes, only for files.
	lastModified?: Date; // Last modified timestamp, only for files.
}

// --- S3FileManager Class ---

/**
 * A TypeScript class to manage file operations on an AWS S3 bucket,
 * simulating common filesystem commands and providing temporary download links.
 */
export class S3FileManager {
	private s3: S3Client;
	private bucketName: string;

	/**
	 * Constructs an S3FileManager instance.
	 * @param config Configuration object containing AWS region and S3 bucket name.
	 */
	constructor ( config: S3FileClassConfig ) {
		this.bucketName = config.bucketName;
		this.s3 = new S3Client( {
			region: config.region,
			// Credentials can be configured here if not using default AWS SDK chain (e.g., env vars, IAM roles)
			credentials: {
				accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
				secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
			}
		} );
	}

	/**
	 * Uploads a file to S3 from a local absolute file path.
	 * Streams the file content, which is efficient for large files.
	 * The file will be set with 'private' ACL.
	 * @param s3Key The S3 object key (e.g., 'documents/my_file.pdf').
	 * @param localFilePath The absolute path to the local file.
	 * @param contentType The MIME type of the file (e.g., 'application/pdf'). If omitted, it attempts to infer it.
	 * @returns A promise that resolves with a success message upon completion.
	 * @throws An error if the local file is not found/accessible or if the S3 upload fails.
	 */
	public async uploadFile ( s3Key: string, localFilePath: string, contentType?: string ): Promise<string> {
		try {
			// Check if the local file exists and is readable
			await fs.promises.access( localFilePath, fs.constants.R_OK );

			// Create a readable stream from the local file
			const fileStream = fs.createReadStream( localFilePath );

			// Infer Content-Type if not provided
			const inferredContentType = contentType || this.inferContentType( localFilePath );

			const command = new PutObjectCommand( {
				Bucket: this.bucketName,
				Key: s3Key,
				Body: fileStream,
				ContentType: inferredContentType,
				ACL: 'private', // Ensure the file remains private
			} );

			await this.s3.send( command );
			return `File ${ localFilePath } uploaded to S3 as ${ s3Key } successfully.`;
		} catch ( error: any ) {
			console.error( `Error uploading file ${ localFilePath } to ${ s3Key }:`, error );
			if ( error.code === 'ENOENT' ) {
				throw new Error( `Local file not found or inaccessible: ${ localFilePath }` );
			}
			throw new Error( `Failed to upload file: ${ error.message }` );
		}
	}

	/**
	 * Generates a temporary pre-signed URL for downloading a private S3 object.
	 * The URL provides temporary access to external users without requiring AWS credentials.
	 * @param s3Key The S3 object key to generate the URL for.
	 * @param expiresInSeconds The duration in seconds for which the URL will be valid (default: 3600 seconds = 1 hour).
	 * @returns A promise that resolves with the pre-signed URL.
	 * @throws An error if URL generation fails.
	 */
	public async getSignedDownloadUrl ( s3Key: string, expiresInSeconds: number = 3600 ): Promise<string> {
		try {
			const command = new GetObjectCommand( {
				Bucket: this.bucketName,
				Key: s3Key,
			} );
			// The getSignedUrl function requires the S3 client and the specific command
			const url = await getSignedUrl( this.s3, command, { expiresIn: expiresInSeconds } );
			return url;
		} catch ( error: any ) {
			console.error( `Error generating signed URL for ${ s3Key }:`, error );
			throw new Error( `Failed to generate signed URL: ${ error.message }` );
		}
	}

	/**
	 * Downloads a file from S3 and saves it to a temporary local file.
	 * Streams the content for efficient handling of large files.
	 * @param s3Key The S3 object key to download.
	 * @param tmpFileName Optional custom name for the temporary file. If not provided, a unique name is generated.
	 * @returns A promise that resolves with the absolute path to the temporary local file.
	 * @throws An error if the download fails or the S3 object has no body.
	 */
	public async getFile ( s3Key: string, tmpFileName?: string ): Promise<string> {
		try {
			const command = new GetObjectCommand( {
				Bucket: this.bucketName,
				Key: s3Key,
			} );

			const response = await this.s3.send( command );

			if ( !response.Body ) {
				throw new Error( `S3 object ${ s3Key } has no valid body.` );
			}

			// Generate a unique temporary file path
			const originalFileName = path.basename( s3Key );
			const tempFilePath = tmpFileName ? tmpFileName : path.join( os.tmpdir(), `${ Date.now() }-${ originalFileName }` );

			// Create a writable stream to the temporary file
			const writeStream = fs.createWriteStream( tempFilePath );

			// Pipe the S3 response body stream to the local file write stream
			// Asserting response.Body as Readable for Node.js stream piping
			const bodyStream = response.Body as Readable;

			return new Promise( ( resolve, reject ) => {
				bodyStream
					.pipe( writeStream )
					.on( 'finish', () => {
						console.log( `File ${ s3Key } downloaded and saved to ${ tempFilePath }` );
						resolve( tempFilePath );
					} )
					.on( 'error', ( err ) => {
						console.error( `Error while downloading file ${ s3Key }:`, err );
						// Clean up the temporary file in case of error
						fs.unlink( tempFilePath, () => { } ); // Do not wait for unlink
						reject( new Error( `Failed to download file: ${ err.message }` ) );
					} );
			} );

		} catch ( error: any ) {
			console.error( `Error retrieving file ${ s3Key } from S3:`, error );
			throw new Error( `Failed to retrieve file: ${ error.message }` );
		}
	}

	/**
	 * Creates a "directory" in S3. In S3, directories are represented by objects with keys ending in '/'.
	 * @param dirPath The path of the directory to create (e.g., 'myfolder/subfolder/').
	 * @returns A promise that resolves with a success message upon creation.
	 * @throws An error if the directory creation fails.
	 */
	public async mkdir ( dirPath: string ): Promise<string> {
		// Ensure the directory key ends with a slash
		const directoryKey = dirPath.endsWith( '/' ) ? dirPath : `${ dirPath }/`;
		try {
			const command = new PutObjectCommand( {
				Bucket: this.bucketName,
				Key: directoryKey,
				Body: '', // An empty body
				ACL: 'private', // Directories should also be private
			} );
			await this.s3.send( command );
			return `Directory ${ directoryKey } created successfully.`;
		} catch ( error: any ) {
			console.error( `Error creating directory ${ directoryKey }:`, error );
			throw new Error( `Failed to create directory: ${ error.message }` );
		}
	}

	/**
	 * Removes an S3 object (file).
	 * @param s3Key The S3 object key to remove.
	 * @returns A promise that resolves with a success message upon removal.
	 * @throws An error if the file removal fails.
	 */
	public async rm ( s3Key: string ): Promise<string> {
		try {
			const command = new DeleteObjectCommand( {
				Bucket: this.bucketName,
				Key: s3Key,
			} );
			await this.s3.send( command );
			return `File ${ s3Key } removed successfully.`;
		} catch ( error: any ) {
			console.error( `Error removing file ${ s3Key }:`, error );
			throw new Error( `Failed to remove file: ${ error.message }` );
		}
	}

	/**
	 * Moves or renames an S3 object. This is achieved by copying the object
	 * to the new location and then deleting the original.
	 * @param sourceKey The S3 object key of the source file.
	 * @param destinationKey The S3 object key of the destination (new name/path).
	 * @returns A promise that resolves with a success message.
	 * @throws An error if the move operation (copy or delete) fails.
	 */
	public async mv ( sourceKey: string, destinationKey: string ): Promise<string> {
		try {
			// Copy the object to the new destination
			const copyCommand = new CopyObjectCommand( {
				Bucket: this.bucketName,
				CopySource: `${ this.bucketName }/${ sourceKey }`, // S3 requires bucket name in CopySource
				Key: destinationKey,
				ACL: 'private', // Maintain private ACL for the new object
			} );
			await this.s3.send( copyCommand );

			// Delete the original object
			const deleteCommand = new DeleteObjectCommand( {
				Bucket: this.bucketName,
				Key: sourceKey,
			} );
			await this.s3.send( deleteCommand );

			return `File moved from ${ sourceKey } to ${ destinationKey } successfully.`;
		} catch ( error: any ) {
			console.error( `Error moving file from ${ sourceKey } to ${ destinationKey }:`, error );
			throw new Error( `Failed to move file: ${ error.message }` );
		}
	}

	/**
	 * Removes an S3 "directory" and all its contents recursively.
	 * This method handles pagination for large directories and uses batch deletion.
	 * @param dirPath The path of the directory to remove (e.g., 'myfolder/').
	 * @returns A promise that resolves with a success message.
	 * @throws An error if the directory removal fails.
	 */
	public async rmdir ( dirPath: string ): Promise<string> {
		const directoryKeyPrefix = dirPath.endsWith( '/' ) ? dirPath : `${ dirPath }/`;
		try {
			let isTruncated = true;
			let continuationToken: string | undefined;
			const objectsToDelete: { Key: string; }[] = [];

			// List all objects under the given prefix, handling pagination
			while ( isTruncated ) {
				const listCommand = new ListObjectsV2Command( {
					Bucket: this.bucketName,
					Prefix: directoryKeyPrefix,
					ContinuationToken: continuationToken,
				} );
				const response = await this.s3.send( listCommand );

				if ( response.Contents ) {
					objectsToDelete.push( ...response.Contents.map( obj => ( { Key: obj.Key as string } ) ) );
				}

				isTruncated = response.IsTruncated || false;
				continuationToken = response.NextContinuationToken;
			}

			if ( objectsToDelete.length > 0 ) {
				// S3's DeleteObjects API can delete up to 1000 objects per call
				const BATCH_SIZE = 1000;
				for ( let i = 0; i < objectsToDelete.length; i += BATCH_SIZE ) {
					const batch = objectsToDelete.slice( i, i + BATCH_SIZE );
					await this.s3.send( new DeleteObjectsCommand( {
						Bucket: this.bucketName,
						Delete: { Objects: batch }
					} ) );
				}
			} else {
				// If the directory itself is represented by an empty object, remove it
				const emptyDirCommand = new DeleteObjectCommand( {
					Bucket: this.bucketName,
					Key: directoryKeyPrefix,
				} );
				await this.s3.send( emptyDirCommand );
			}

			return `Directory ${ directoryKeyPrefix } and its contents removed successfully.`;
		} catch ( error: any ) {
			console.error( `Error removing directory ${ directoryKeyPrefix }:`, error );
			throw new Error( `Failed to remove directory: ${ error.message }` );
		}
	}

	/**
	 * Lists the contents (files and "directories") of an S3 path (prefix).
	 * This method handles pagination to return all results in a single call,
	 * simulating the behavior of the 'ls' shell command.
	 * @param prefix The S3 prefix (corresponding to a directory) to list. Defaults to the bucket root.
	 * @returns A promise that resolves with an array of S3LsEntry objects.
	 * @throws An error if the listing operation fails.
	 */
	public async ls ( prefix: string = '' ): Promise<S3LsEntry[]> {
		// Ensure the prefix ends with a slash if it's not empty, to treat it as a directory
		const actualPrefix = prefix && !prefix.endsWith( '/' ) ? `${ prefix }/` : prefix;
		const allResults: S3LsEntry[] = [];
		let isTruncated = true;
		let continuationToken: string | undefined;

		try {
			// Loop to fetch all pages of results until no more are truncated
			while ( isTruncated ) {
				const command = new ListObjectsV2Command( {
					Bucket: this.bucketName,
					Prefix: actualPrefix,
					Delimiter: '/', // Essential for listing "directories" (common prefixes)
					MaxKeys: 1000, // Fetch up to 1000 keys per request
					ContinuationToken: continuationToken, // Use token for subsequent requests
				} );

				const response = await this.s3.send( command );

				// Process objects (files) directly under the current prefix
				if ( response.Contents ) {
					for ( const content of response.Contents ) {
						// Exclude the directory object itself (e.g., 'myfolder/') from the file list
						if ( content.Key && content.Key !== actualPrefix ) {
							const name = path.basename( content.Key );
							allResults.push( {
								name: name,
								type: 'file',
								fullPath: content.Key,
								size: content.Size,
								lastModified: content.LastModified,
							} );
						}
					}
				}

				// Process common prefixes (representing "sub-directories")
				if ( response.CommonPrefixes ) {
					for ( const commonPrefix of response.CommonPrefixes ) {
						if ( commonPrefix.Prefix ) {
							// Extract the directory name by removing the current prefix and trailing slash
							const dirName = commonPrefix.Prefix.substring( actualPrefix.length ).replace( /\/$/, '' );
							if ( dirName ) { // Ensure it's not an empty string
								allResults.push( {
									name: dirName,
									type: 'directory',
									fullPath: commonPrefix.Prefix,
								} );
							}
						}
					}
				}

				// Update pagination state
				isTruncated = response.IsTruncated || false;
				continuationToken = response.NextContinuationToken;
			}

			// Sort results alphabetically by name for a cleaner output
			return allResults.sort( ( a, b ) => a.name.localeCompare( b.name ) );
		} catch ( error: any ) {
			console.error( `Error listing prefix ${ actualPrefix }:`, error );
			throw new Error( `Failed to list content: ${ error.message }` );
		}
	}

	/**
	 * Internal utility to infer the MIME type of a file based on its extension.
	 * @param filePath The path of the file.
	 * @returns The inferred MIME type string. Defaults to 'application/octet-stream' if unknown.
	 */
	private inferContentType ( filePath: string ): string {
		const ext = path.extname( filePath ).toLowerCase();
		switch ( ext ) {
			case '.jpg':
			case '.jpeg': return 'image/jpeg';
			case '.png': return 'image/png';
			case '.gif': return 'image/gif';
			case '.pdf': return 'application/pdf';
			case '.txt': return 'text/plain';
			case '.html': return 'text/html';
			case '.css': return 'text/css';
			case '.js': return 'application/javascript';
			case '.json': return 'application/json';
			case '.xml': return 'application/xml';
			case '.zip': return 'application/zip';
			case '.tar': return 'application/x-tar';
			case '.gz': return 'application/gzip';
			case '.mp3': return 'audio/mpeg';
			case '.mp4': return 'video/mp4';
			case '.webm': return 'video/webm';
			// Add more common types as needed
			default: return 'application/octet-stream'; // Default for unknown binary data
		}
	}
}