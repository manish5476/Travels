
import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger';

let _producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
    if (_producer) return _producer;
    const kafka = new Kafka({ clientId: config.serviceName, brokers: config.kafka.brokers, ssl: config.isProd });
    _producer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
    await _producer.connect();
    return _producer;
}

export function publishPostEvent(topic: string, payload: Record<string, unknown>): void {
    // Fire-and-forget — never await or block the request
    getProducer().then(p => p.send({
        topic,
        compression: CompressionTypes.GZIP,
        messages: [{
            key: String(payload['postId'] || payload['authorId'] || 'unknown'),
            value: JSON.stringify({ ...payload, _source: config.serviceName, _ts: new Date().toISOString() }),
            timestamp: Date.now().toString(),
        }],
    })).catch(err => logger.error({ err, topic }, 'Kafka publish failed'));
}

export async function disconnectKafka(): Promise<void> {
    if (_producer) { await _producer.disconnect(); _producer = null; }
}
