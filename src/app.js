import express from 'express';
import { CI_COLLATION, COLLECTION, ping } from './db.js';

const SERVICE_NAME = process.env.SERVICE_NAME || 'resenas-service';
const VERSION = '1.0.0';

const PROJECTION = { _id: 0 };

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message) => new HttpError(400, 'bad_request', message);
const notFound = (message) => new HttpError(404, 'not_found', message);

function parseInteger(query, name, { min, max, def }) {
  const raw = query[name];
  if (raw === undefined) return def;
  if (typeof raw !== 'string' || !/^-?\d+$/.test(raw)) {
    throw badRequest(`El parámetro ${name} debe ser un número entero.`);
  }
  const value = Number(raw);
  if (value < min || (max !== undefined && value > max)) {
    const range = max !== undefined ? `estar entre ${min} y ${max}` : `ser mayor o igual a ${min}`;
    throw badRequest(`El parámetro ${name} debe ${range}.`);
  }
  return value;
}

function parsePattern(query, name, prefix) {
  const raw = query[name];
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !new RegExp(`^${prefix}[0-9]+$`, 'i').test(raw)) {
    throw badRequest(`El parámetro ${name} debe tener el formato ${prefix}<número>.`);
  }
  return raw;
}

export function createApp(collection) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', async (req, res) => {
    try {
      await ping();
      res.json({ status: 'ok', service: SERVICE_NAME, collection: COLLECTION, version: VERSION });
    } catch (err) {
      res.status(503).json({ error: 'service_unavailable', message: `Base de datos no disponible: ${err.message}` });
    }
  });

  app.get('/items', async (req, res) => {
    const productoId = parsePattern(req.query, 'productoId', 'PRD');
    const clienteId = parsePattern(req.query, 'clienteId', 'CLI');
    const puntajeMin = parseInteger(req.query, 'puntajeMin', { min: 1, max: 5 });
    const limit = parseInteger(req.query, 'limit', { min: 1, max: 100, def: 20 });
    const offset = parseInteger(req.query, 'offset', { min: 0, def: 0 });

    const filter = {};
    if (productoId !== undefined) filter.productoId = productoId;
    if (clienteId !== undefined) filter.clienteId = clienteId;
    if (puntajeMin !== undefined) filter.puntaje = { $gte: puntajeMin };

    const [items, total] = await Promise.all([
      collection
        .find(filter, { projection: PROJECTION, collation: CI_COLLATION })
        .sort({ id: 1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter, { collation: CI_COLLATION }),
    ]);

    res.json({ items, total, limit, offset });
  });

  app.get('/items/:id', async (req, res) => {
    const { id } = req.params;
    const item = await collection.findOne({ id }, { projection: PROJECTION, collation: CI_COLLATION });
    if (!item) throw notFound(`No existe ${id}.`);
    res.json(item);
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', message: `Ruta inexistente: ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'internal_error', message: 'Error interno del servidor.' });
  });

  return app;
}
