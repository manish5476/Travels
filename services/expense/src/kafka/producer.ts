import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { logger } from '../config/index';

let producer: Producer | null = null;

export async function connectKafka(brokers: string, clientId: string): Promise<void> {
    const kafka = new Kafka({
        clientId,
        brokers: brokers.split(',').map(b => b.trim()),
        ssl: process.env.NODE_ENV === 'production',
        retry: { retries: 5, initialRetryTime: 300 },
    });

    producer = kafka.producer({ allowAutoTopicCreation: false });
    await producer.connect();
    logger.info('✅ Kafka producer connected');
}

export async function publishEvent(
    topic: string,
    key: string,
    payload: object
): Promise<void> {
    if (!producer) {
        logger.warn({ topic }, 'Kafka producer not ready — event dropped');
        return;
    }
    await producer.send({
        topic,
        compression: CompressionTypes.GZIP,
        messages: [{
            key,
            value: JSON.stringify({ ...payload, _timestamp: new Date().toISOString() }),
        }],
    });
}

export async function disconnectKafka(): Promise<void> {
    if (producer) { await producer.disconnect(); producer = null; }
}
