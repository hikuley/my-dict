import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import wordsRouter from './routes/words.js';
import { createWSServer } from './ws/index.js';
import { startConsumer } from './kafka/consumer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/words', wordsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
createWSServer(server);

server.listen(PORT, async () => {
  console.log(`API server running on port ${PORT}`);
  try {
    await startConsumer();
    console.log('[startup] Kafka consumer started');
  } catch (err) {
    console.error('[startup] Failed to start Kafka consumer:', err.message);
  }
});
