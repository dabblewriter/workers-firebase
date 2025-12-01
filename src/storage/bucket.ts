import { File } from './file';
import type { Storage } from './storage';

export interface BucketFile {
  name: string;
  size: string;
  updated: string;
  contentType?: string;
  [key: string]: unknown;
}

/**
 * Represents a Cloud Storage bucket
 */
export class Bucket {
  constructor(
    private storage: Storage,
    private bucketName: string
  ) {}

  /**
   * Get a reference to a file in this bucket
   * @param filePath The path to the file within the bucket
   * @returns A File instance
   */
  file(filePath: string): File {
    return new File(this.storage, this.bucketName, filePath);
  }

  /**
   * List files in this bucket
   * @param options Optional parameters for listing (prefix, maxResults, etc.)
   * @returns An array of file metadata objects
   */
  async list(options?: {
    prefix?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<BucketFile[]> {
    const token = await this.storage.getToken();

    const params = new URLSearchParams();
    if (options?.prefix) params.append('prefix', options.prefix);
    if (options?.maxResults) params.append('maxResults', options.maxResults.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}/o${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json() as { items?: BucketFile[] };
    return data.items || [];
  }
}
