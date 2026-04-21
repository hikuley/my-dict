import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-dict-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
let connected = false;

export async function connectProducer() {
  if (!connected) {
    await producer.connect();
    connected = true;
    console.log('[kafka-producer] Connected');
  }
}

export async function sendToTopic(topic, message) {
  await connectProducer();
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
  console.log('[kafka-producer] Message sent to topic:', topic);
}

export default producer;
