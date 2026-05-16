import { Kafka, Producer, CompressionTypes, logLevel } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger';

let _producer: Producer | null = null;

// ── GET OR CREATE PRODUCER ────────────────────────────────────
async function getProducer(): Promise<Producer> {
    if (_producer) return _producer;

    const kafka = new Kafka({
        clientId: config.serviceName,
        brokers: config.kafka.brokers,
        ssl: config.isProd,
        logLevel: config.isDev ? logLevel.INFO : logLevel.WARN,
    });

    _producer = kafka.producer({
        allowAutoTopicCreation: false,
        idempotent: true,  // Exactly-once delivery guarantee
        transactionTimeout: 30000,
    });

    await _producer.connect();
    logger.info('Kafka producer connected');
    return _producer;
}

// ── PUBLISH AUTH EVENT ────────────────────────────────────────
// topic:   Kafka topic name (e.g., 'user.registered')
// payload: Event data object. userId used as partition key.
// NON-BLOCKING: errors are logged but never thrown.
// The auth response must NOT depend on Kafka being healthy.
export async function publishAuthEvent(
    topic: string,
    payload: Record<string, unknown>
): Promise<void> {

    try {
        const producer = await getProducer();
        await producer.send({
            topic,
            compression: CompressionTypes.GZIP,
            messages: [{
                // Use userId as partition key so all events for same user
                // go to the same partition (preserves ordering)
                key: String(payload['userId'] || 'unknown'),
                value: JSON.stringify({
                    ...payload,
                    _meta: {
                        source: config.serviceName,
                        publishedAt: new Date().toISOString(),
                        topic,
                    },
                }),
                timestamp: Date.now().toString(),
            }],
        });

        logger.info({ topic, userId: payload['userId'] }, 'Auth event published');
    } catch (err) {
        // Log but don't fail the request
        // Kafka is NOT in the critical auth path
        logger.error({ err, topic, userId: payload['userId'] },
            'Failed to publish auth event — non-fatal');
    }
}

// ── DISCONNECT (called on SIGTERM) ────────────────────────────
export async function disconnectKafka(): Promise<void> {
    if (_producer) {
        await _producer.disconnect();
        _producer = null;
        logger.info('Kafka producer disconnected');
    }
}

// import { Kafka, Producer, CompressionTypes, logLevel } from 'kafkajs';
// import { config } from '../config';
// import { logger } from './logger';

// let producer: Producer | null = null;

// async function getProducer(): Promise<Producer> {
//     if (producer) return producer;

//     const kafka = new Kafka({
//         clientId: config.serviceName,
//         brokers: config.kafka.brokers,
//         ssl: config.nodeEnv === 'production',
//         logLevel: logLevel.WARN,
//     });

//     producer = kafka.producer({
//         allowAutoTopicCreation: false,
//         idempotent: true,    // Exactly-once delivery
//         transactionTimeout: 30000,
//     });

//     await producer.connect();
//     logger.info('Kafka producer connected'); return producer;
// }

// export async function publishAuthEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
//     try {
//         const p = await getProducer();
//         await p.send({
//             topic,
//             compression: CompressionTypes.GZIP,
//             messages: [{
//                 key: payload.userId as string,
//                 value: JSON.stringify({ ...payload, publishedAt: new Date().toISOString() }),
//                 timestamp: Date.now().toString(),
//             }],
//         });
//         logger.info({ topic, userId: payload.userId }, 'Auth event published');
//     } catch (err) {
//         // Log but don't fail the request — Kafka is not in the critical path
//         logger.error({ err, topic }, 'Failed to publish auth event');
//     }
// }

// // Graceful shutdown
// export async function disconnectKafka(): Promise<void> {
//     if (producer) await producer.disconnect();
// }
