import type {
  api, DocumentData, OrderByDirection, PartialWithFieldValue, ReadTransactionOptions,
  SetOptions, UpdateData, WhereFilterOp, WithFieldValue
} from './types';
import { DocumentSnapshot } from './document';
import { Firestore } from './firestore';
import { decodePath, encodeValue } from './serializer';
import { createCursorSymbol, querySymbol, transactionSymbol } from './symbols';


 const directionOperators: {[k: string]: api.StructuredQueryDirection} = {
  asc: 'ASCENDING',
  desc: 'DESCENDING',
};

const comparisonOperators: {[k: string]: api.FieldFilterOperator} = {
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '==': 'EQUAL',
  '!=': 'NOT_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  'array-contains': 'ARRAY_CONTAINS',
  in: 'IN',
  'not-in': 'NOT_IN',
  'array-contains-any': 'ARRAY_CONTAINS_ANY',
};

const unaryOperators = {
  '==': {
    null: 'IS_NULL' as api.UnaryFilterOperator,
    NaN: 'IS_NAN' as api.UnaryFilterOperator,
  },
  '!=': {
    null: 'IS_NOT_NULL' as api.UnaryFilterOperator,
    NaN: 'IS_NOT_NAN' as api.UnaryFilterOperator,
  },
};

const inequalityFilters = new Set([
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
]);

export enum FieldPath {
  documentId = '__name__',
}

export class Reference {
  constructor(readonly firestore: Firestore, path: string | string[]) {
    const segments = typeof path === 'string' ? trim(path).split('/') : path;
    if (segments.length % 2 === 0) {
      return new DocumentReference(firestore, segments);
    } else {
      return new CollectionReference(firestore, segments);
    }
  }
}

export class DocumentReference<T = DocumentData> {
  readonly segments: string[];

  constructor(readonly firestore: Firestore, path: string | string[], readonly transactionOptions?: ReadTransactionOptions) {
    const segments = typeof path === 'string' ? trim(path).split('/').filter(Boolean) : path;
    if (segments.length % 2 !== 0) throw new Error('A document reference must have an even number of segments, received ' + segments.join('/'));
    this.segments = segments;
  }

  collection(path: string): CollectionReference {
    return new CollectionReference(this.firestore, this.segments.concat(trim(path).split('/')));
  }

  get id(): string {
    return this.segments[this.segments.length - 1] || null;
  }

  get path() {
    return this.segments.join('/');
  }

  get qualifiedPath() {
    return `${this.firestore.basePath}/${this.segments.join('/')}`;
  }

  get parent(): CollectionReference<T> {
    return new CollectionReference<T>(this.firestore, this.path.split('/').slice(0, -1).join('/'));
  }

  async get(fields?: string[]) {
    return (await this.firestore.batchGet([ this ], fields, this.transactionOptions))[0];
  }

  async listCollections(): Promise<CollectionReference[]> {
    const response: api.ListCollectionIdsResponse = await this.firestore.request(
      'POST',
      `${this.path}:listCollectionIds`,
      { pageSize: Math.pow(2, 16) - 1 }
    );
    return response.collectionIds.map(id => this.collection(id));
  }

  async create(data: WithFieldValue<T>): Promise<Date> {
    return (await this.firestore.batch().create(this, data).commit())[0];
  }

  async delete(): Promise<void> {
    await this.firestore.batch().delete(this).commit();
  }

  set(data: PartialWithFieldValue<T>, options: SetOptions): Promise<Date>;
  set(data: WithFieldValue<T>): Promise<Date>;
  async set(data: PartialWithFieldValue<T>, options?: SetOptions): Promise<Date> {
    return (await this.firestore.batch().set(this, data, options).commit())[0];
  }

  async update(data: UpdateData<T>): Promise<Date> {
    return (await this.firestore.batch().update(this, data).commit())[0];
  }
}


export class QuerySnapshot<T = DocumentData> {

  constructor(
    readonly query: Query<T>,
    readonly readTime: Date,
    readonly size: number,
    readonly docs: Array<DocumentSnapshot<T>>,
  ) {}

  forEach(callback: (result: DocumentSnapshot<T>) => void, thisArg?: unknown): void {
    for (const doc of this.docs) {
      callback.call(thisArg, doc);
    }
  }
}


export interface QueryOptions extends api.StructuredQuery {
  filters: api.Filter[];
  reverse?: true;
}


export class Query<T = DocumentData> {
  protected [querySymbol]: QueryOptions = undefined;

  constructor(readonly ref: CollectionReference<T>, query: QueryOptions) {
    this[querySymbol] = query;
  }

  where(fieldPath: string, opStr: WhereFilterOp, value: unknown): Query<T> {
    let filter: api.Filter;
    if (value === undefined) throw new Error('Where value cannot be undefined');
    if (fieldPath === FieldPath.documentId) {
      if (typeof value === 'string') value = this.ref.doc(value);
      else if (Array.isArray(value) && typeof value[0] === 'string') value = value.map(value => this.ref.doc(value));
    }
    if ((opStr === '==' || opStr === '!=') && (value === null || typeof value === 'number' && isNaN(value))) {
      const op = unaryOperators[opStr][value as any] as api.UnaryFilterOperator;
      filter = { unaryFilter: { field: { fieldPath }, op } };
    } else {
      filter = { fieldFilter: { field: { fieldPath }, op: comparisonOperators[opStr], value: encodeValue(value) } };
    }
    return new Query<T>(this.ref, { ...this[querySymbol], filters: [ ...this[querySymbol].filters, filter ] });
  }

  select(...fieldPaths: string[]): Query<T> {
    if (!fieldPaths.length) fieldPaths.push(FieldPath.documentId);
    return new Query(this.ref, {
      ...this[querySymbol],
      select: { fields: fieldPaths.map(fieldPath => ({ fieldPath })) },
    });
  }

  orderBy(fieldPath: string, directionStr?: OrderByDirection): Query<T> {
    return new Query(this.ref, {
      ...this[querySymbol],
      orderBy: [ ...this[querySymbol].orderBy, { field: { fieldPath }, direction: directionOperators[directionStr] } ],
    });
  }

  limit(limit: number): Query<T> {
    const { reverse, ...q } = this[querySymbol];
    return new Query(this.ref, { ...q, limit });
  }

  limitToLast(limit: number): Query<T> {
    return new Query(this.ref, { ...this[querySymbol], limit, reverse: true });
  }

  offset(offset: number): Query<T> {
    return new Query(this.ref, { ...this[querySymbol], offset });
  }

  startAt(...fieldValuesOrDocumentSnapshot: Array<DocumentSnapshot<unknown> | unknown>): Query<T> {
    return new Query(this.ref, { ...this[querySymbol], startAt: this[createCursorSymbol](fieldValuesOrDocumentSnapshot, true) });
  }

  startAfter(...fieldValuesOrDocumentSnapshot: Array<DocumentSnapshot<unknown> | unknown>): Query<T> {
    return new Query(this.ref, { ...this[querySymbol], startAt: this[createCursorSymbol](fieldValuesOrDocumentSnapshot, false) });
  }

  endAt(...fieldValuesOrDocumentSnapshot: Array<DocumentSnapshot<unknown> | unknown>): Query<T> {
    return new Query(this.ref, { ...this[querySymbol], endAt: this[createCursorSymbol](fieldValuesOrDocumentSnapshot, true) });
  }

  endAfter(...fieldValuesOrDocumentSnapshot: Array<DocumentSnapshot<unknown> | unknown>): Query<T> {
    return new Query(this.ref, { ...this[querySymbol], endAt: this[createCursorSymbol](fieldValuesOrDocumentSnapshot, false) });
  }

  private [createCursorSymbol](cursorValuesOrDocumentSnapshot: Array<DocumentSnapshot | unknown>, before: boolean): api.Cursor {
    const fieldOrders = getFieldOrders(this[querySymbol]);
    let fieldValues: unknown[];

    if (cursorValuesOrDocumentSnapshot.length === 1 && cursorValuesOrDocumentSnapshot[0] instanceof DocumentSnapshot) {
      fieldValues = extractFieldValues(cursorValuesOrDocumentSnapshot[0] as DocumentSnapshot, fieldOrders);
    } else {
      fieldValues = cursorValuesOrDocumentSnapshot;
    }

    if (fieldValues.length > fieldOrders.length) {
      throw new Error(
        'Too many cursor values specified. The specified ' +
          'values must match the orderBy() constraints of the query.'
      );
    }

    const cursor: api.Cursor = { values: [], before };

    for (let i = 0; i < fieldValues.length; ++i) {
      let fieldValue = fieldValues[i];

      if (fieldOrders[i].field === FieldPath.documentId as string && typeof fieldValue === 'string') {
        fieldValue = this.ref.doc(fieldValue);
      }
      if (typeof fieldValue === 'undefined') {
        throw new Error('A cursor value must be provided for the ' + fieldOrders[i].field.fieldPath + ' field.');
      }

      cursor.values!.push(encodeValue(fieldValue));
    }

    return cursor;
  }

  async get(): Promise<QuerySnapshot<T>> {
    const { reverse, filters, ...query } = this[querySymbol];
    if (filters.length > 1) {
      query.where = { compositeFilter: { op: 'AND', filters } };
    } else if (filters.length) {
      query.where = filters[0];
    }
    if (reverse) {
      if (!query.orderBy.length) {
        throw new Error('limitToLast() queries require specifying at least one orderBy() clause.');
      }
      // Flip the orderBy directions since we want the last results
      query.orderBy = query.orderBy.map(({ field, direction }) =>
        ({ field, direction: direction === 'DESCENDING' ? 'ASCENDING' : 'DESCENDING' }));
      // Swap the cursors to match the now-flipped query ordering.
      query.startAt = query.endAt ? { values: query.endAt.values, before: !query.endAt.before } : undefined;
      query.endAt = query.startAt ? { values: query.startAt.values, before: !query.startAt.before } : undefined;
    }
    const response: api.RunQueryResponse[] = await this.ref.firestore.request('POST', `${this.ref.parent.path}:runQuery`, {
      structuredQuery: query, transaction: this.ref.firestore[transactionSymbol],
    });

    const readTime = new Date(response[0].readTime);
    if (response[0]?.error) throw new Error(response[0].error.message);
    if (response[0]?.skippedResults) response.shift();
    if (reverse) response.reverse();
    const docs = response.filter(e => e.document).map(e =>
      new DocumentSnapshot<T>(this.ref.doc(decodePath(e.document.name).replace(this.ref.path, '')), e.document, e.readTime)
    );
    return new QuerySnapshot<T>(this, readTime, response.length, docs);
  }
}


export class CollectionReference<T = DocumentData> extends Query {
  readonly segments: string[];

  constructor(readonly firestore: Firestore, path: string | string[], readonly transactionOptions?: ReadTransactionOptions) {
    const segments = typeof path === 'string' ? trim(path).split('/') : path;
    if (segments.length % 2 !== 1) throw new Error('A collection reference must have an odd number of segments, received ' + segments.join('/'));
    super(null, { from: [{ collectionId: segments[segments.length - 1] }], filters: [], orderBy: [] });
    (this.ref as any) = this;
    this.segments = segments;
  }

  collection(path: string): CollectionReference {
    return new CollectionReference(this.firestore, this.segments.concat(trim(path).split('/')));
  }

  doc(path?: string): DocumentReference<T> {
    if (!path) path = this.firestore.autoId();
    return new DocumentReference(this.firestore, this.segments.concat(trim(path).split('/')));
  }

  get id(): string {
    return this.segments[this.segments.length - 1] || null;
  }

  get path() {
    return this.segments.join('/');
  }

  get qualifiedPath() {
    return `${this.firestore.basePath}/${this.segments.join('/')}`;
  }

  get parent(): DocumentReference {
    return new DocumentReference(this.firestore, this.path.split('/').slice(0, -1).join('/'));
  }

  async listDocuments(): Promise<Array<DocumentReference<T>>> {
    const query = new URLSearchParams({
      showMissing: 'true',
      pageSize: String(Math.pow(2, 16) - 1),
    });
    const response: api.ListDocumentsResponse = await this.firestore.request('GET', this.path, query);
    return response.documents.map(doc => new DocumentReference(this.firestore, doc.name));
  }

  async add(data: WithFieldValue<T>): Promise<DocumentReference<T>> {
    const ref = this.doc();
    await ref.create(data);
    return ref;
  }
}

function trim(path: string) {
  return path.replace(/^\/|\/$/g, '');
}

function getFieldOrders(query: QueryOptions) {
  const fieldOrders = query.orderBy.slice();
  if (!fieldOrders.length) {
    for (const fieldFilter of query.filters) {
      if (inequalityFilters.has(fieldFilter.fieldFilter?.op)) {
        fieldOrders.push({ field: fieldFilter.fieldFilter.field });
        break;
      }
    }
  }
  if (!fieldOrders.some(o => o.field === FieldPath.documentId as string)) {
    fieldOrders.push({ field: { fieldPath: FieldPath.documentId }});
  }
  return fieldOrders;
}

function extractFieldValues(documentSnapshot: DocumentSnapshot, fieldOrders: api.StructuredQueryOrder[]): unknown[] {
  const fieldValues: unknown[] = [];

  for (const fieldOrder of fieldOrders) {
    if (fieldOrder.field.fieldPath === FieldPath.documentId) {
      fieldValues.push(documentSnapshot.ref);
    } else {
      const fieldValue = documentSnapshot.get(fieldOrder.field.fieldPath);
      if (fieldValue === undefined) {
        throw new Error(
          `Field "${fieldOrder.field}" is missing in the provided DocumentSnapshot. ` +
            'Please provide a document that contains values for all specified ' +
            'orderBy() and where() constraints.'
        );
      } else {
        fieldValues.push(fieldValue);
      }
    }
  }
  return fieldValues;
}