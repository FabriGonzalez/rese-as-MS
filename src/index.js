import dotenv from 'dotenv';

// .env tiene prioridad; atlas-credentials.env queda como respaldo local.
dotenv.config({ quiet: true });
dotenv.config({ path: 'atlas-credentials.env', quiet: true });

const { connect, close } = await import('./db.js');
const { createApp } = await import('./app.js');

const port = Number(process.env.PORT) || 3000;

const collection = await connect().catch((err) => {
  console.error('No se pudo conectar a MongoDB. Revisá MONGODB_URI y la Network Access List de Atlas.');
  console.error(err.message);
  process.exit(1);
});
const app = createApp(collection);

const server = app.listen(port, () => {
  console.log(`Microservicio de resenas escuchando en http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await close();
      process.exit(0);
    });
  });
}
