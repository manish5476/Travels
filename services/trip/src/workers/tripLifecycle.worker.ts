
import { Kafka, Consumer } from 'kafkajs';
import { Trip } from '../models/trip.model';
import { tripStateMachine } from '../stateMachine/trip.stateMachine';
import { aiPlannerService } from '../services/aiPlanner.service';
import { packingListService } from '../services/packingList.service';
import { config } from '../config';
import { logger } from '../utils/logger';

let consumer: Consumer | null = null;

export async function startLifecycleWorker(): Promise<void> {
    const kafka = new Kafka({ clientId: `${config.serviceName}-lifecycle`, brokers: config.kafka.brokers });
    consumer = kafka.consumer({ groupId: 'trip-lifecycle-group' });
    await consumer.connect();
    await consumer.subscribe({ topics: ['trip.state_changed', 'post.created'], fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const event = JSON.parse(message.value!.toString());
            try {
                if (topic === 'trip.state_changed') {
                    // When trip moves to PLANNING: auto-populate packing list
                    if (event.toState === 'planning') {
                        await packingListService.prePopulate(event.tripId, event.adminId)
                            .catch(err => logger.error({ err, tripId: event.tripId }, 'Packing list prepopulate failed'));
                    }
                    // When trip moves to COMPLETED: queue memory reel generation
                    if (event.toState === 'completed') {
                        await Trip.updateOne({ _id: event.tripId }, { memoryReelStatus: 'processing' });
                        // Memory reel worker picks this up via a Bull job
                        logger.info({ tripId: event.tripId }, 'Memory reel generation queued');
                    }
                }
                if (topic === 'post.created' && event.tripId) {
                    // Increment trip post count when a post is tagged to it
                    await Trip.updateOne({ _id: event.tripId }, { $inc: { postCount: 1 } });
                }
            } catch (err) { logger.error({ err, topic, event }, 'Lifecycle worker error'); }
        },
    });
    logger.info('Trip lifecycle worker started');
}
