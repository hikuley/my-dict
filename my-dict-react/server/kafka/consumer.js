import { Kafka } from 'kafkajs';
import { broadcastMessage, clearProcessing } from '../ws/index.js';
import { generateWordData } from '../services/claude.js';
import { wordExists, insertWord } from '../services/words.js';

const kafka = new Kafka({
  clientId: 'my-dict-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { initialRetryTime: 3000, retries: 15 },
});

const consumer = kafka.consumer({
  groupId: 'word-generator-group',
  sessionTimeout: 180000,
  heartbeatInterval: 10000,
  retry: { retries: 15 },
});

const admin = kafka.admin();

async function ensureTopic(topic) {
  await admin.connect();
  const topics = await admin.listTopics();
  if (!topics.includes(topic)) {
    await admin.createTopics({ topics: [{ topic, numPartitions: 1 }] });
    console.log('[kafka-consumer] Created topic:', topic);
  }
  await admin.disconnect();
}

async function processWord(word, slug) {
  try {
    if (await wordExists(slug)) {
      console.log('[kafka-consumer] Word already exists:', slug);
      clearProcessing(slug);
      broadcastMessage('word-error', { word, slug, error: 'This word already exists in the dictionary' });
      return;
    }

    const wordData = await generateWordData(word, slug);
    const created = await insertWord(wordData, slug, word);

    console.log('[kafka-consumer] Word created:', created.slug);
    clearProcessing(slug);
    broadcastMessage('word-ready', { word: created.title, slug: created.slug });
  } catch (err) {
    console.error('[kafka-consumer] Error processing word:', err.message);
    clearProcessing(slug);
    if (err.code === '23505') {
      broadcastMessage('word-error', { word, slug, error: 'This word already exists' });
    } else {
      broadcastMessage('word-error', { word, slug, error: 'Failed to generate word' });
    }
  }
}

export async function startConsumer() {
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await ensureTopic('word-generate');
      await consumer.connect();
      await consumer.subscribe({ topic: 'word-generate', fromBeginning: false });
      console.log('[kafka-consumer] Listening on topic: word-generate');

      await consumer.run({
        eachMessage: async ({ message }) => {
          let payload;
          try {
            payload = JSON.parse(message.value.toString());
          } catch {
            console.error('[kafka-consumer] Invalid message format');
            return;
          }

          const { word, slug } = payload;
          console.log('[kafka-consumer] Processing word:', word);
          broadcastMessage('word-processing', { word, slug, status: 'processing' });

          // Process concurrently — don't block the consumer
          processWord(word, slug);
        },
      });

      console.log('[kafka-consumer] Consumer running');
      return;
    } catch (err) {
      console.log('[kafka-consumer] Attempt ' + attempt + '/' + maxRetries + ' failed: ' + err.message);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 5000));
      try { await consumer.disconnect(); } catch {}
    }
  }
}
