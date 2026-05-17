# User Service Architecture

The **User Service** is a dedicated Node.js microservice built with Express and TypeScript. Its primary responsibility is managing user profiles, traveler statistics, follower graphs, and notification preferences.

## Responsibilities
1. **Profile Management**: Storing bios, display names, and handling profile avatar uploads directly to AWS S3.
2. **Social Graph**: Managing the complex relationships of Followers, Following, and Blocking users.
3. **Traveler Ranks**: Processing and awarding XP, tracking consecutive usage streaks, and unlocking traveler badges.
4. **Caching**: Heavily utilizing Redis to cache highly-read data like Follower Counts and Profiles to reduce MongoDB load.
5. **Event Consumption**: Listening to Kafka for events triggered by other services (e.g., when a new user registers, or when a trip is completed).

---

## Folder Structure

```text
/src
├── config/           # Environment variables, DB connection, Redis connection
├── controllers/      # Route handlers for Profiles, Follows, and Blocks
├── middlewares/      # auth.middleware.ts (Verifies JWT using the Public Key)
├── models/           # Mongoose schemas (User, Follow relationships)
├── routes/           # Express API endpoints
├── services/         # Core business logic (Rank processing, Follow graph logic)
├── utils/            # Redis cache wrappers, S3 upload scripts, Kafka config
├── workers/          # Kafka Event Consumers (runs in the background)
└── server.ts         # Server bootstrap
```

---

## Core Components

### 1. Stateless Authentication (`src/middlewares/auth.middleware.ts`)
The User Service does not know the user's password or OTP. Instead, it intercepts incoming requests and looks for the `Authorization: Bearer <TOKEN>` header.
Using the `JWT_PUBLIC_KEY` provided in its `.env` file, the middleware mathematically verifies that the token was legitimately signed by the Auth Service. If valid, it extracts the `userId` and proceeds. 

### 2. The Kafka Consumer (`src/workers/userEvent.consumer.ts`)
When the server starts, it boots up a Kafka Consumer in the background. This consumer listens to specific "topics" (channels) on the Kafka broker:
- **`user.registered`**: Fired by the Auth Service. Triggers the creation of a blank profile.
- **`trip.state_changed`**: Fired by the Trip Service (future). Triggers an XP reward and updates the user's total trip count.
- **`booking.confirmed`**: Fired by the Booking Service (future). Triggers an XP reward.

### 3. Redis Caching (`src/utils/cache.ts`)
Because social apps fetch user profiles and follower counts thousands of times a minute, making a database query every time is too slow.
The `cache.ts` utility implements a **Cache-Aside Pattern**:
1. Check Redis for the profile. If found, return instantly.
2. If not found, fetch from MongoDB.
3. Save it to Redis for 5 minutes, then return to the user.
Whenever a user updates their profile or gets a new follower, the cache is explicitly deleted to ensure fresh data.

### 4. AWS S3 Presigned URLs (`src/services/avatar.service.ts`)
Uploading images directly to a Node.js server causes heavy memory usage. Instead, the User Service generates a temporary, cryptographically-signed **AWS S3 Presigned URL**.
The Mobile App uses this URL to upload the image directly to the Amazon S3 bucket, bypassing the Node.js server entirely. Once uploaded, the server saves the final image URL to the database.
