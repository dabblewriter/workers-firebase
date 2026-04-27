import { FieldValue, UpdateCollector } from './field-value';
import { Firestore } from './firestore';
import { Reference } from './reference';
import type { DocumentData, api } from './types';
const RESOURCE_PATH_RE = /^projects\/([^/]+)\/databases\/([^/]+)(?:\/documents\/)?/;

export function encode(map: DocumentData, collector?: UpdateCollector): api.MapValue {
  const fields: api.MapValue = {};
  Object.entries(map).forEach(([key, value]) => {
    collector?.enterField(key);
    if (value !== undefined) {
      const encoded = encodeValue(value, collector);
      if (encoded !== undefined) fields[key] = encoded;
    }
    // Maps contribute dotted leaf paths via recursion, so adding the map's
    // own path would cause merge to overwrite sibling fields. Arrays must
    // add their own path: Firestore fieldPaths can't address array elements,
    // so arrays are always replaced whole at the parent path.
    const shouldAddMask = !fields[key] || !fields[key]!.mapValue;
    collector?.leaveField(shouldAddMask);
  });
  return fields;
}

export function encodeValue(value: any, collector?: UpdateCollector): api.Value | undefined {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && !(value === 0 && 1 / value === 1 / -0) && Number.isSafeInteger(value))
    return { integerValue: '' + value };
  if (typeof value === 'number') return { doubleValue: value };
  if (value instanceof FieldValue) {
    collector?.transform(value);
    return undefined;
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value.qualifiedPath) return { referenceValue: value.qualifiedPath };
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof ArrayBuffer) return { bytesValue: bytesToBase64(new Uint8Array(value)) };
  if (value && value.buffer instanceof ArrayBuffer) return { bytesValue: bytesToBase64(value) };
  if (typeof value === 'object' && 'latitude' in value && 'longitude' in value && Object.keys(value).length === 2)
    return { geoPointValue: value };
  // Don't pass the collector into array elements. Firestore fieldPaths
  // cannot address elements by index, so any inner paths the elements
  // registered (e.g. "books.id") would be invalid. Arrays are replaced
  // whole at the parent field path.
  if (Array.isArray(value)) {
    const values = value.map(v => encodeValue(v)).filter((v): v is api.Value => v !== undefined);
    return { arrayValue: { values } };
  }
  if (typeof value === 'object') return { mapValue: { fields: encode(value, collector) } };
  throw new Error(`Unsupported value type: ${typeof value}`);
}

export function decode<T = DocumentData>(firestore: Firestore, fields: api.MapValue): T {
  const obj: DocumentData = {};
  if (!fields) return obj as T;
  for (const prop of Object.keys(fields).sort()) {
    obj[prop] = decodeValue(firestore, fields[prop]);
  }
  return obj as T;
}

export function decodeValue(firestore: Firestore, valueObj: api.Value): any {
  const entry = Object.entries(valueObj).pop();
  if (!entry) return undefined;
  const [key, value] = entry;
  switch (key) {
    case 'nullValue':
      return null;
    case 'booleanValue':
      return value;
    case 'integerValue':
      return parseInt(value, 10);
    case 'doubleValue':
      return typeof value === 'number' ? value : parseFloat(value);
    case 'timestampValue':
      return new Date(value);
    case 'stringValue':
      return value;
    case 'bytesValue':
      return base64ToBytes(value).buffer;
    case 'geoPointValue':
      return value;
    case 'arrayValue':
      return value.values?.map((v: api.Value) => decodeValue(firestore, v)) || [];
    case 'mapValue':
      return decode(firestore, value.fields);
    case 'referenceValue':
      return new Reference(firestore, value.replace(RESOURCE_PATH_RE, ''));
  }
}

export function decodePath(path: string): string {
  return path.replace(RESOURCE_PATH_RE, '');
}

/**
 * Encode a Uint8Array to base64 without corrupting binary data.
 * Chunked to avoid stack overflow on large arrays (String.fromCharCode has argument limits).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Decode a base64 string back to a Uint8Array of raw bytes.
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
