import type { FieldValue } from './field-value';

/**
 * Document data (for use with `DocumentReference.set()`) consists of fields
 * mapped to values.
 */
export type DocumentData = { [field: string]: any };

/**
 * Similar to Typescript's `Partial<T>`, but allows nested fields to be
 * omitted and FieldValues to be passed in as property values.
 */
export type PartialWithFieldValue<T> =
  | Partial<T>
  | (T extends Primitive ? T : T extends {} ? { [K in keyof T]?: PartialWithFieldValue<T[K]> | FieldValue } : never);

/**
 * Allows FieldValues to be passed in as a property value while maintaining
 * type safety.
 */
export type WithFieldValue<T> =
  | T
  | (T extends Primitive ? T : T extends {} ? { [K in keyof T]: WithFieldValue<T[K]> | FieldValue } : never);

/**
 * Update data (for use with [update]{@link DocumentReference#update})
 * that contains paths mapped to values. Fields that contain dots reference
 * nested fields within the document. FieldValues can be passed in
 * as property values.
 *
 * You can update a top-level field in your document by using the field name
 * as a key (e.g. `foo`). The provided value completely replaces the contents
 * for this field.
 *
 * You can also update a nested field directly by using its field path as a
 * key (e.g. `foo.bar`). This nested field update replaces the contents at
 * `bar` but does not modify other data under `foo`.
 */
export type UpdateData<T> = T extends Primitive
  ? T
  : T extends {}
    ? { [K in keyof T]?: UpdateData<T[K]> | FieldValue } & NestedUpdateFields<T>
    : Partial<T>;

/** Primitive types. */
export type Primitive = string | number | boolean | undefined | null;

/**
 * For each field (e.g. 'bar'), find all nested keys (e.g. {'bar.baz': T1,
 * 'bar.qux': T2}). Intersect them together to make a single map containing
 * all possible keys that are all marked as optional
 */
export type NestedUpdateFields<T extends Record<string, unknown>> = UnionToIntersection<
  {
    [K in keyof T & string]: ChildUpdateFields<K, T[K]>;
  }[keyof T & string] // Also include the generated prefix-string keys.
>;

/**
 * Helper for calculating the nested fields for a given type T1. This is needed
 * to distribute union types such as `undefined | {...}` (happens for optional
 * props) or `{a: A} | {b: B}`.
 *
 * In this use case, `V` is used to distribute the union types of `T[K]` on
 * `Record`, since `T[K]` is evaluated as an expression and not distributed.
 *
 * See https://www.typescriptlang.org/docs/handbook/advanced-types.html#distributive-conditional-types
 */
export type ChildUpdateFields<K extends string, V> =
  // Only allow nesting for map values
  V extends Record<string, unknown>
    ? // Recurse into the map and add the prefix in front of each key
      // (e.g. Prefix 'bar.' to create: 'bar.baz' and 'bar.qux'.
      AddPrefixToKeys<K, UpdateData<V>>
    : // UpdateData is always a map of values.
      never;

/**
 * Returns a new map where every key is prefixed with the outer key appended
 * to a dot.
 */
export type AddPrefixToKeys<Prefix extends string, T extends Record<string, unknown>> =
  // Remap K => Prefix.K. See https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as
  { [K in keyof T & string as `${Prefix}.${K}`]+?: T[K] };

/**
 * Given a union type `U = T1 | T2 | ...`, returns an intersected type
 * `(T1 & T2 & ...)`.
 *
 * Uses distributive conditional types and inference from conditional types.
 * This works because multiple candidates for the same type variable in
 * contra-variant positions causes an intersection type to be inferred.
 * https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types
 * https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
 */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

export type SetOptions = { readonly merge?: boolean };

export type WhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'in'
  | 'not-in'
  | 'array-contains-any';

export type OrderByDirection = 'desc' | 'asc';

export interface ReadTransactionOptions {
  transaction?: string;
  readTime?: string;
}

export interface ReadOptions {
  readonly fieldMask?: string[];
}

export interface ConsistencyOptions {
  transaction?: string;
  newTransaction?: api.TransactionOptions;
  readTime?: string;
}

export namespace api {
  export interface FieldsMapValue {
    fields: MapValue;
  }

  export interface Value {
    nullValue?: null;
    booleanValue?: boolean;
    integerValue?: string;
    doubleValue?: number;
    timestampValue?: string;
    stringValue?: string;
    bytesValue?: string;
    referenceValue?: string;
    geoPointValue?: LatLng;
    arrayValue?: ArrayValue;
    mapValue?: FieldsMapValue;
  }

  export interface ArrayValue {
    values: Value[];
  }

  export interface MapValue {
    [key: string]: Value;
  }

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface BatchGetRequest {
    documents: string[];
    mask?: DocumentMask;
    // Union field consistency_selector can be only one of the following:
    transaction?: string;
    newTransaction?: TransactionOptions;
    readTime?: string;
    // End of list of possible types for union field consistency_selector.
  }

  export interface BatchGetResponse {
    transaction?: string;
    readTime: string;
    found?: Document;
    missing?: string;
  }

  export interface BatchWriteRequest {
    writes: Write[];
    labels?: { [key: string]: string };
  }

  export interface BatchWriteResponse {
    writeResults: WriteResult[];
    status: Status[];
  }

  export interface BeginTransactionRequest {
    options: TransactionOptions;
  }

  export interface BeginTransactionResponse {
    transaction: string;
  }

  export interface CommitRequest {
    writes: Write[];
    transaction: string;
  }

  export interface CommitResponse {
    writeResults: WriteResult[];
    commitTime: string;
  }

  export interface Write {
    updateMask?: DocumentMask;
    updateTransforms?: FieldTransform[];
    currentDocument?: Precondition;

    // Union field operation can be only one of the following:
    update?: Document;
    delete?: string;
    transform?: DocumentTransform;
    // End of list of possible types for union field operation.
  }

  export interface FieldTransform {
    fieldPath: string;
    // Union field transform_type can be only one of the following:
    setToServerValue?: ServerValue;
    increment?: Value;
    maximum?: Value;
    minimum?: Value;
    appendMissingElements?: ArrayValue;
    removeAllFromArray?: ArrayValue;
    // End of list of possible types for union field transform_type.
  }

  export interface FieldReference {
    fieldPath?: string;
  }

  export interface Filter {
    compositeFilter?: CompositeFilter;
    fieldFilter?: FieldFilter;
    unaryFilter?: UnaryFilter;
  }

  export interface CompositeFilter {
    op?: CompositeFilterOperator;
    filters?: Filter[];
  }

  export interface FieldFilter {
    field?: FieldReference;
    op?: FieldFilterOperator;
    value?: Value;
  }

  export interface UnaryFilter {
    op?: UnaryFilterOperator;
    field?: FieldReference;
  }

  export interface CollectionSelector {
    collectionId: string;
    allDescendants?: boolean;
  }

  export interface Cursor {
    values: Value[];
    before?: boolean;
  }

  export interface StructuredQuery {
    select?: StructuredQueryProjection;
    from?: [CollectionSelector];
    where?: Filter;
    orderBy?: StructuredQueryOrder[];
    startAt?: Cursor;
    endAt?: Cursor;
    offset?: number;
    limit?: number;
  }

  export interface StructuredQueryOrder {
    field?: FieldReference;
    direction?: StructuredQueryDirection;
  }

  export interface StructuredQueryProjection {
    fields?: FieldReference[];
  }

  export interface StructuredQueryOrder {
    field?: FieldReference;
    direction?: StructuredQueryDirection;
  }

  export type CompositeFilterOperator = 'OPERATOR_UNSPECIFIED' | 'AND';
  export type FieldFilterOperator =
    | 'OPERATOR_UNSPECIFIED'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'EQUAL'
    | 'NOT_EQUAL'
    | 'ARRAY_CONTAINS'
    | 'IN'
    | 'ARRAY_CONTAINS_ANY'
    | 'NOT_IN';
  export type UnaryFilterOperator = 'OPERATOR_UNSPECIFIED' | 'IS_NAN' | 'IS_NULL' | 'IS_NOT_NAN' | 'IS_NOT_NULL';
  export type StructuredQueryDirection = 'DIRECTION_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING';

  export enum ServerValue {
    SERVER_VALUE_UNSPECIFIED = 'SERVER_VALUE_UNSPECIFIED',
    REQUEST_TIME = 'REQUEST_TIME',
  }

  export interface Document {
    name: string;
    fields?: MapValue;
    createTime?: string;
    updateTime?: string;
  }

  export interface DocumentMask {
    fieldPaths: string[];
  }

  export interface TransactionOptions {
    // Union field mode can be only one of the following:
    readOnly?: ReadOnly;
    readWrite?: ReadWrite;
    // End of list of possible types for union field mode.
  }

  export interface ReadOnly {
    readTime: string;
  }

  export interface ReadWrite {
    retryTransaction: string;
  }

  export interface Precondition {
    // Union field condition_type can be only one of the following:
    exists?: boolean;
    updateTime?: string;
    // End of list of possible types for union field condition_type.
  }

  export interface DocumentTransform {
    document: string;
    fieldTransforms: FieldTransform[];
  }

  export interface WriteResult {
    updateTime?: string;
    transformResults?: Value[];
  }

  export interface ListCollectionIdsResponse {
    collectionIds: string[];
    nextPageToken?: string;
  }

  export interface ListDocumentsResponse {
    documents: Document[];
    nextPageToken?: string;
  }

  export interface RunQueryResponse {
    error?: { code: number; message: string; status: string };
    transaction?: string;
    document?: Document;
    readTime: string;
    skippedResults?: number;
    done?: boolean;
  }

  export interface Status {
    code: number;
    message: string;
    details?: {
      '@type': string;
      [key: string]: any;
    }[];
  }
}
