import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

function getAdminApp(): App {
  if (!_app) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "", "base64").toString("utf8")
    );
    _app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount) });
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
