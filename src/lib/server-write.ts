import {
  deleteField,
  FieldValue,
  getDocFromServer,
  type DocumentReference,
} from "firebase/firestore";

export const SERVER_WRITE_NOT_CONFIRMED =
  "The server has not confirmed this save. Check your connection, then save again — nothing has changed online yet.";

const DELETE_FIELD = deleteField();

function isDeleteSentinel(value: unknown): value is FieldValue {
  return value instanceof FieldValue && value.isEqual(DELETE_FIELD);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsOnlyDeleteSentinels(value: Record<string, unknown>): boolean {
  const entries = Object.values(value);
  return entries.length > 0 && entries.every(
    (entry) => isDeleteSentinel(entry) || (isObject(entry) && containsOnlyDeleteSentinels(entry)),
  );
}

function matchesExpected(serverValue: unknown, expectedValue: unknown): boolean {
  if (Array.isArray(expectedValue)) {
    return Array.isArray(serverValue)
      && serverValue.length === expectedValue.length
      && expectedValue.every((entry, index) => matchesExpected(serverValue[index], entry));
  }

  if (isObject(expectedValue)) {
    if (!isObject(serverValue)) {
      return serverValue === undefined && containsOnlyDeleteSentinels(expectedValue);
    }
    return Object.entries(expectedValue).every(([key, entry]) => {
      if (isDeleteSentinel(entry)) {
        return !Object.prototype.hasOwnProperty.call(serverValue, key);
      }
      return matchesExpected(serverValue[key], entry);
    });
  }

  return Object.is(serverValue, expectedValue);
}

export function writeMatchesServer(
  serverData: unknown,
  expected: Record<string, unknown>,
): boolean {
  return serverData !== undefined && matchesExpected(serverData, expected);
}

export async function confirmServerWrite(
  ref: DocumentReference,
  expected: Record<string, unknown>,
): Promise<boolean> {
  const snapshot = await getDocFromServer(ref);
  return snapshot.exists() && writeMatchesServer(snapshot.data(), expected);
}
