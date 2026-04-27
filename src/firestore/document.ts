import { DocumentReference } from './reference';
import { decode, decodeValue } from './serializer';
import { docSymbol, readTimeSymbol } from './symbols';
import { api, DocumentData } from './types';

export class DocumentSnapshot<T = DocumentData> {
  private [docSymbol]: api.Document;
  private [readTimeSymbol]: string | undefined;

  constructor(
    readonly ref: DocumentReference<T>,
    doc: api.Document = { name: ref.qualifiedPath },
    readTime?: string
  ) {
    this[docSymbol] = doc;
    this[readTimeSymbol] = readTime;
  }

  get createTime(): Date | undefined {
    const t = this[docSymbol].createTime;
    return t ? new Date(t) : undefined;
  }

  get updateTime(): Date | undefined {
    const t = this[docSymbol].updateTime;
    return t ? new Date(t) : undefined;
  }

  get readTime(): Date | undefined {
    const t = this[readTimeSymbol];
    return t ? new Date(t) : undefined;
  }

  get exists() {
    return !!this[docSymbol]?.fields;
  }

  data(): T | null {
    const fields = this[docSymbol]?.fields;
    return fields ? decode<T>(this.ref.firestore, fields) : null;
  }

  get(field: string): any {
    let fields: api.MapValue | undefined = this[docSymbol].fields;
    const components = field.split('.');
    while (fields && components.length > 1) {
      const next = components.shift()!;
      fields = fields[next]?.mapValue?.fields;
    }
    const last = components[0];
    const value = fields && last !== undefined ? fields[last] : undefined;
    return value ? decodeValue(this.ref.firestore, value) : undefined;
  }
}
