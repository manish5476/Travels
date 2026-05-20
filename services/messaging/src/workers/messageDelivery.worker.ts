
import { Kafka, Consumer } from 'kafkajs';
import { conversationService } from '../services/conversation.service';
import { messageService } from '../services/message.service';
import { io } from '../config/socket';
import { Rooms, ServerEvents } from '../sockets/rooms';
import { config } from '../config';
import { logger } from '../utils/logger';

let consumer: Consumer | null = null;

export async function startMessageDeliveryWorker(): Promise<void> {
    const kafka = new Kafka({ clientId: `${config.serviceName}-delivery`, brokers: config.kafka.brokers });
    consumer = kafka.consumer({ groupId: 'messaging-delivery-group' });
    await consumer.connect();

    await consumer.subscribe({
        topics: [
            'trip.state_changed',        // Trip lifecycle → system message in group
            'trip.collaborator_joined',  // Someone joined → system message
            'trip.collaborator_removed', // Someone removed → system message
            'expense.added',             // Expense added → system message
            'trip.waypoint_checkin',     // Waypoint check-in → system message
        ],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const event = JSON.parse(message.value!.toString());
            try {
                // Find the trip's group conversation
                const { Conversation } = await import('../models/conversation.model');
                const conv = await Conversation.findOne({ tripId: event.tripId }).select('_id');
                if (!conv) return; // No group chat for this trip yet

                const convId = conv._id.toString();
                let systemText = '';

                switch (topic) {
                    case 'trip.state_changed':
                        const stateMessages: Record<string, string> = {
                            planning: '🎉 Trip planning has started! Group chat is now active.',
                            active: '🚀 Your trip is now ACTIVE! Check-in to your first waypoint.',
                            completed: '🏁 Trip completed! Your Memory Reel is being generated.',
                            cancelled: '❌ This trip has been cancelled.',
                        };
                        systemText = stateMessages[event.toState] || `Trip status changed to: ${event.toState}`;
                        break;

                    case 'trip.collaborator_joined':
                        systemText = `👋 Someone new joined the trip!`;
                        break;

                    case 'trip.collaborator_removed':
                        systemText = `A member has left the trip.`;
                        break;

                    case 'expense.added':
                        systemText = `💰 New expense added: ${event.description || 'Expense'} — ₹${event.amount}`;
                        break;

                    case 'trip.waypoint_checkin':
                        systemText = `📍 Someone just checked in at ${event.waypointLabel || 'a waypoint'}!`;
                        break;
                }

                if (!systemText) return;

                const msg = await messageService.createSystemMessage(convId, systemText);

                // Broadcast to all connected members in the conversation room
                if (io) {
                    io.to(Rooms.conversation(convId)).emit(ServerEvents.MESSAGE_NEW, msg.toObject());
                }

            } catch (err) {
                logger.error({ err, topic, event }, 'Message delivery worker error');
            }
        },
    });

    logger.info('Message delivery worker started');
}

export async function stopMessageDeliveryWorker(): Promise<void> {
    if (consumer) { await consumer.disconnect(); consumer = null; }
}
