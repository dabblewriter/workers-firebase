import { FirebaseService } from '../service';
import type { ServiceAccountUnderscored, Settings } from '../types';
import { Bucket } from './bucket';

const scope = 'https://www.googleapis.com/auth/devstorage.read_write';

/**
 * Cloud Storage service for downloading files from Cloud Storage buckets
 */
export class Storage extends FirebaseService {
  constructor(settings: Settings | ServiceAccountUnderscored) {
    super('storage', 'https://storage.googleapis.com', settings, '');
    // GCS requires OAuth tokens (unlike Firestore/Auth which accept self-signed JWTs)
    const parentGetToken = this.getToken;
    this.getToken = () => parentGetToken({ scope });
  }

  /**
   * Get a reference to a bucket
   * @param bucketName The name of the bucket (e.g., 'my-bucket' or 'my-bucket.appspot.com')
   * @returns A Bucket instance
   */
  bucket(bucketName: string): Bucket {
    return new Bucket(this, bucketName);
  }
}
