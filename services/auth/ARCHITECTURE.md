# Auth Service Architecture

The **Auth Service** is a dedicated Node.js microservice built with Express and TypeScript. Its primary and only responsibility is to manage user authentication, verification, and token issuance.

## Responsibilities
1. **OTP Verification**: Integrating with Firebase Admin to verify phone number OTPs.
2. **OAuth Processing**: Handling Google Sign-in identity verification.
3. **JWT Issuance**: Generating asymmetric RS256 JSON Web Tokens for secure, stateless authentication.
4. **Rate Limiting**: Using Redis to prevent brute-force login attempts and OTP spam.
5. **Event Broadcasting**: Alerting the rest of the microservice ecosystem (via Kafka) when a new user registers.

---

## Folder Structure

```text
/src
├── config/           # Environment variables (Zod validation), DB connection
├── controllers/      # Route handlers (the "glue" between routes and services)
├── middlewares/      # Rate limiters and internal security checks
├── models/           # Mongoose schemas (Auth record, Refresh tokens)
├── routes/           # Express API endpoints
├── services/         # Core business logic (Token generation, Firebase verification)
├── utils/            # Kafka publisher, Pino logger, custom error handlers
└── server.ts         # Server bootstrap
```

---

## Core Components

### 1. Firebase Phone Auth (`src/services/auth.service.ts`)
Instead of managing SMS gateways (like Twilio) manually, this service delegates OTP sending to Firebase on the client side. The Mobile App receives a Firebase ID Token upon successful OTP entry, and passes it to the Auth Service.
The Auth Service then uses the `firebase-admin` SDK to cryptographically verify the Firebase ID Token.

### 2. JWT Generation (Asymmetric RS256)
Most basic applications use HS256 (symmetric) keys, where the same password is used to encrypt and decrypt tokens.
Because this is a microservice architecture, we use **RS256**:
- **Private Key**: Kept *only* in the Auth Service's `.env`. Used to securely sign the JWT.
- **Public Key**: Shared across all other services (like User Service). They use it to verify the JWT without needing the private key.

### 3. Kafka Publisher (`src/utils/kafkaPublisher.ts`)
When a user logs in for the first time, a new `Auth` document is created in MongoDB. The Auth Service immediately publishes a `user.registered` event to the Kafka message broker.
It does not wait for a response. This asynchronous nature ensures the login process is lightning fast.

### 4. Redis Rate Limiting (`src/middlewares/rateLimiter.ts`)
To prevent attackers from spamming the login endpoints, Redis is utilized to store IP/Device-based hit counts. If a user attempts to hit the `/v1/auth/login` endpoint more than 5 times in 15 minutes, Redis blocks the request at the middleware level before it even reaches the database.
