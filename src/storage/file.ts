import type { Storage } from './storage';

/**
 * Represents a file in Cloud Storage
 */
export class File {
  constructor(
    private storage: Storage,
    private bucketName: string,
    private filePath: string
  ) {}

  /**
   * Download the file contents
   * @returns The file contents as an ArrayBuffer (default)
   */
  async download(): Promise<ArrayBuffer>;
  /**
   * Download the file contents
   * @param options Configuration for download response type
   * @returns The file contents in the requested format
   */
  async download(
    options: { responseType: 'arrayBuffer' }
  ): Promise<ArrayBuffer>;
  async download(options: { responseType: 'text' }): Promise<string>;
  async download<T = Record<string, unknown>>(
    options: { responseType: 'json' }
  ): Promise<T>;
  async download(options: { responseType: 'blob' }): Promise<Blob>;
  async download(
    options?: { responseType?: 'arrayBuffer' | 'text' | 'json' | 'blob' }
  ): Promise<ArrayBuffer | string | Record<string, unknown> | Blob> {
    const token = await this.storage.getToken();
    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}/o/${encodeURIComponent(this.filePath)}?alt=media`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const responseType = options?.responseType ?? 'arrayBuffer';

    switch (responseType) {
      case 'text':
        return response.text();
      case 'json':
        return response.json();
      case 'blob':
        return response.blob();
      case 'arrayBuffer':
      default:
        return response.arrayBuffer();
    }
  }

  /**
   * Upload file contents
   * @param content The file content (ArrayBuffer, Blob, or string)
   * @param options Optional metadata (contentType, etc.)
   * @returns The uploaded file metadata
   */
  async upload(
    content: ArrayBuffer | Blob | string,
    options?: {
      contentType?: string;
    }
  ): Promise<Record<string, unknown>> {
    const token = await this.storage.getToken();
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucketName}/o?uploadType=media&name=${encodeURIComponent(this.filePath)}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (options?.contentType) {
      headers['Content-Type'] = options.contentType;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: content,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return response.json();
  }
}
