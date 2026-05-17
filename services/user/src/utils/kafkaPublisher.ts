import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger';

let _producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
    if (_producer) return _producer;
    const kafka = new Kafka({ clientId: config.serviceName, brokers: config.kafka.brokers, ssl: config.isProd });
    _producer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
    await _producer.connect();
    logger.info('Kafka producer connected');
    return _producer;
}

export async function publishUserEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    try {
        const p = await getProducer();
        await p.send({
            topic,
            compression: CompressionTypes.GZIP,
            messages: [{
                key: String(payload['userId'] || 'unknown'),
                value: JSON.stringify({ ...payload, _source: config.serviceName, _ts: new Date().toISOString() }),
                timestamp: Date.now().toString(),
            }],
        });
    } catch (err) {
        logger.error({ err, topic }, 'Kafka publish failed — non-fatal');
    }
}

export async function disconnectKafka(): Promise<void> {
    if (_producer) { await _producer.disconnect(); _producer = null; }
}
