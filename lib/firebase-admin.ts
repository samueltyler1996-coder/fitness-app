import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

function getAdminApp(): App {
  if (!_app) {
    _app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: Buffer.from(process.env.FIREBASE_PRIVATE_KEY ?? "", "base64").toString("utf8"),
          }),
        });
  }
  return _app;
}

export function getAdminDb(): Firestore {
  if (!_db) {
    getAdminApp();
    _db = getFirestore();
  }
  return _db;
}

// Convenience proxy so callers can use adminDb.collection() etc.
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (getAdminDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
