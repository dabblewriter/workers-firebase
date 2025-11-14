import { createId } from 'crypto-id';
import { FirebaseService } from '../service';
import type { HTTPMethod, ServiceAccountUnderscored, Settings } from '../types';
import { DocumentSnapshot } from './document';
import { CollectionReference, DocumentReference } from './reference';
import { transactionSymbol, writesSymbol } from './symbols';
import type { ConsistencyOptions, api } from './types';
import { WriteBatch } from './write-batch';


export class Firestore extends FirebaseService {
  basePath: string;
  [transactionSymbol]: string = undefined;
  [writesSymbol]: api.Write[] = undefined;

  constructor(settings: Settings | ServiceAccountUnderscored, apiKey: string) {
    super('firestore', 'https://firestore.googleapis.com/v1', settings, apiKey);
    this.basePath = `projects/${this.settings.projectId}/databases/${this.settings.databaseId || '(default)'}/documents`;
  }

  collection(path: string): CollectionReference {
    return new CollectionReference(this, path);
  }

  doc(path: string): DocumentReference {
    return new DocumentReference(this, path);
  }

  async runTransaction<T>(updateFunction: () => Promise<T>, options?: api.TransactionOptions): Promise<T> {
    this[transactionSymbol] = (await this.request('POST', ':beginTransaction', { options }) as {transaction: string}).transaction;
    this[writesSymbol] = [];
    const result = await updateFunction();
    (await this.request('POST', ':commit', { writes: this[writesSymbol], transaction: this[transactionSymbol] }));
    this[transactionSymbol] = undefined;
    this[writesSymbol] = undefined;
    return result;
  }

  batch(): WriteBatch {
    return new WriteBatch(this);
  }

  request<T>(method: HTTPMethod, path: string, search?: URLSearchParams, body?: object): Promise<T>;
  request<T>(method: HTTPMethod, path: string, body?: object): Promise<T>;
  async request<T>(method: HTTPMethod, path?: string, searchOrBody?: URLSearchParams | object, body?: object): Promise<T> {
    if (path && path[0] !== ':' && path[0] !== '/') path = '/' + path;
    path = this.basePath + path;
    return super.request(method, path, searchOrBody as URLSearchParams, body);
  }

  autoId(): string {
    return createId(20);
  }

  async batchGet(refs: DocumentReference[], fields?: string[], consistency?: ConsistencyOptions): Promise<DocumentSnapshot[]> {
    const mask = fields && { fieldPaths: fields };
    const request: api.BatchGetRequest = { documents: refs.map(ref => ref.qualifiedPath), mask, ...consistency, transaction: this[transactionSymbol] };
    const response: api.BatchGetResponse[] = await this.request('POST', ':batchGet',  request);
    const docMap = new Map<string, api.BatchGetResponse>();
    // return in the same order as requested
    response.forEach(result => docMap.set(result.missing || result.found.name, result));
    return request.documents.map((name, i) => {
      const result = docMap.get(name);
      const doc = result.missing ? null : result.found;
      return new DocumentSnapshot(refs[i], doc, result.readTime);
    });
  }
}
