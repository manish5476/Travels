
import { Kafka, Consumer } from 'kafkajs';
import { config } from '../config';
import { userService } from '../services/user.service';
import { rankService } from '../services/rank.service';
import { logger } from '../utils/logger';

let consumer: Consumer | null = null;

export async function startKafkaConsumers(): Promise<void> {
    const kafka = new Kafka({
        clientId: `${config.serviceName}-consumer`,
        brokers: config.kafka.brokers,
        ssl: config.isProd,
    });

    consumer = kafka.consumer({ groupId: 'user-service-group' });
    await consumer.connect();

    // Subscribe to all topics this service cares about
    await consumer.subscribe({
        topics: [
            'user.registered',   // from Auth Service → create profile
            'trip.state_changed',// from Trip Service  → update trip count, award XP
            'booking.confirmed', // from Booking Service → award XP
        ],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const event = JSON.parse(message.value!.toString());
            logger.info({ topic, userId: event.userId }, 'Kafka event received');

            try {
                switch (topic) {

                    case 'user.registered': {
                        // Create the user profile document
                        const existing = await userService.getById(event.userId).catch(() => null);
                        if (!existing) {
                            await userService.createFromAuthEvent({
                                userId: event.userId,
                                phone: event.phone,
                                email: event.email,
                                displayName: event.displayName,
                                avatarUrl: event.avatarUrl,
                            });
                        }
                        break;
                    }

                    case 'trip.state_changed': {
                        // Award XP when a trip is completed
                        if (event.toState === 'completed') {
                            await rankService.awardXp(event.adminId, 'TRIP_COMPLETED');
                            await userService.incrementCounter(event.adminId, 'tripCount');
                        }
                        break;
                    }

                    case 'booking.confirmed': {
                        // Award XP for booking via platform
                        await rankService.awardXp(event.userId, 'BOOKING_MADE');
                        break;
                    }
                }
            } catch (err) {
                // Log but don't re-throw — Kafka should not retry business logic errors
                logger.error({ err, topic, event }, 'Failed to process Kafka event');
            }
        },
    });

    logger.info('Kafka consumers started');
}

export async function stopKafkaConsumers(): Promise<void> {
    if (consumer) { await consumer.disconnect(); consumer = null; }
}
