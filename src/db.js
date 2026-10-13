import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'resenas';
export const COLLECTION = 'resenas';

if (!uri) {
  throw new Error('Falta la variable de entorno MONGODB_URI');
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

// Comparación de texto sin distinguir mayúsculas (strength 2 ignora mayúsculas, no acentos).
export const CI_COLLATION = { locale: 'en', strength: 2 };

export async function connect() {
  await client.connect();
  const collection = client.db(dbName).collection(COLLECTION);
  // Índice con la misma collation para que los filtros por id/productoId/clienteId lo usen.
  await collection
    .createIndex({ id: 1 }, { unique: true, collation: CI_COLLATION })
    .catch((err) => console.warn('No se pudo crear el índice sobre id:', err.message));
  return collection;
}

export async function ping() {
  await client.db(dbName).command({ ping: 1 });
}

export async function close() {
  await client.close();
}
