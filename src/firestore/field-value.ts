import { encodeValue } from './serializer';
import { api } from './types';

export class FieldValue {
  /**
   * Returns a sentinel used with set(), create() or update() to include a
   * server-generated timestamp in the written data.
   *
   * @return The FieldValue sentinel for use in a call to set(), create() or
   * update().
   */
  static serverTimestamp() {
    return new FieldValue('setToServerValue', 'REQUEST_TIME');
  }

  static maximum(value: number) {
    return new FieldValue('maximum', value);
  }

  static minimum(value: number) {
    return new FieldValue('minimum', value);
  }

  /**
   * Returns a special value that can be used with set(), create() or update()
   * that tells the server to increment the field's current value by the given
   * value.
   *
   * If either current field value or the operand uses floating point
   * precision, both values will be interpreted as floating point numbers and
   * all arithmetic will follow IEEE 754 semantics. Otherwise, integer
   * precision is kept and the result is capped between -2^63 and 2^63-1.
   *
   * If the current field value is not of type 'number', or if the field does
   * not yet exist, the transformation will set the field to the given value.
   *
   * @param n The value to increment by.
   * @return The FieldValue sentinel for use in a call to set(), create() or
   * update().
   */
  static increment(n: number): FieldValue {
    return new FieldValue('increment', n);
  }

  /**
   * Returns a special value that can be used with set(), create() or update()
   * that tells the server to union the given elements with any array value
   * that already exists on the server. Each specified element that doesn't
   * already exist in the array will be added to the end. If the field being
   * modified is not already an array it will be overwritten with an array
   * containing exactly the specified elements.
   *
   * @param elements The elements to union into the array.
   * @return The FieldValue sentinel for use in a call to set(), create() or
   * update().
   */
  static arrayUnion(...elements: any[]): FieldValue {
    return new FieldValue('appendMissingElements', elements);
  }

  /**
   * Returns a special value that can be used with set(), create() or update()
   * that tells the server to remove the given elements from any array value
   * that already exists on the server. All instances of each element
   * specified will be removed from the array. If the field being modified is
   * not already an array it will be overwritten with an empty array.
   *
   * @param elements The elements to remove from the array.
   * @return The FieldValue sentinel for use in a call to set(), create() or
   * update().
   */
  static arrayRemove(...elements: any[]): FieldValue {
    return new FieldValue('removeAllFromArray', elements);
  }

  constructor(
    readonly transform: string,
    readonly value: any
  ) {}

  encode(fieldPath: string): api.FieldTransform {
    const value = fieldPath === 'setToServerValue' ? this.value : encodeValue(this.value);
    return { fieldPath, [this.transform]: value };
  }
}

const SIMPLE_FIELD_SEGMENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

/**
 * Escape a single field-path segment for use in a Firestore fieldPath string.
 * A fieldPath is segments joined by '.'. Each segment is either a simple
 * identifier matching [a-zA-Z_][a-zA-Z_0-9]* or a backtick-quoted string
 * where backticks and backslashes inside are escaped with a leading backslash.
 */
export function escapeFieldSegment(segment: string): string {
  if (SIMPLE_FIELD_SEGMENT.test(segment)) return segment;
  return '`' + segment.replace(/[\\`]/g, m => '\\' + m) + '`';
}

function joinFieldPath(paths: string[]): string {
  return paths.map(escapeFieldSegment).join('.');
}

export class UpdateCollector {
  paths: string[] = [];
  mask: api.DocumentMask = { fieldPaths: [] };
  transforms: api.FieldTransform[] = [];

  transform(transform: FieldValue) {
    this.transforms.push(transform.encode(joinFieldPath(this.paths)));
  }

  enterField(field: string) {
    this.paths.push(field);
  }

  leaveField(addMask: boolean) {
    // If the field is not set, and it wasn't a transform, add it to the mask
    const path = joinFieldPath(this.paths);
    if (addMask && this.transforms[this.transforms.length - 1]?.fieldPath !== path) {
      this.mask.fieldPaths.push(path);
    }
    this.paths.pop();
  }
}
