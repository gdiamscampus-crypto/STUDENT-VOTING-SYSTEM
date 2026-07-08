/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, writeBatch, query, where } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "charismatic-ace-5n56p",
  appId: "1:818169506748:web:2020efb263e7cea574d9b9",
  apiKey: "AIzaSyCVzGMcP4pq09xwE1zThFNdRSqlhiqg500",
  authDomain: "charismatic-ace-5n56p.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-0dbcbf34-88ce-4060-9824-63ae5416abe4",
  storageBucket: "charismatic-ace-5n56p.firebasestorage.app",
  messagingSenderId: "818169506748",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
const db = getFirestore(app, "ai-studio-0dbcbf34-88ce-4060-9824-63ae5416abe4");

// Initialize Firebase Storage
const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { db, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, writeBatch, storage, query, where };
