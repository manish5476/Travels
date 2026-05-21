__TRIP PARTY__

Complete Engineering & Product System Design

Designed to MNC\-Grade Standards: Instagram ┬À Snapchat ┬À Google Maps ┬À Uber ┬À Airbnb

__  Version 2\.0  |  Full System Blueprint  |  Confidential  |  2025  __

__18__

Microservices

__7__

Data Stores

__40\+__

API Endpoints

__5__

Phases

__25\+__

Systems

__MNC__

Grade

__1\. Engineering Philosophy & Core Design Laws__

Every company that reached global scale ÔÇö Instagram, Snapchat, Google Maps, Uber ÔÇö built on non\-negotiable engineering laws baked in from day one, not added later\. Trip Party must do the same\.

__1\.1 The 10 Laws We Build By__

__\#__

__Law__

__What It Means__

__Violating This Means__

L1

Design for 100x, Build for 1x

Every schema, queue, and API must handle 100x current load without redesign\. Partition data early\. Prefer async\.

Rebuilding core systems post\-viral moment\. Losing users during growth\.

L2

Network is Always Broken

Every mobile action must handle offline\. Queue writes\. Optimistic UI\. Exponential backoff retry\.

App crashes in Ladakh\. Users lose data\. 1\-star reviews flood in\.

L3

Latency is a Feature

Feed < 200ms\. Map tiles < 100ms\. Story open < 50ms\. Every 100ms of delay costs engagement\.

App feels slow\. Competitor wins\. Churn spike\.

L4

Data is the Moat

Collect behavioral signals from Day 1\. Every tap, scroll depth, dwell time\. Build ML pipelines early\.

No feed algorithm\. No recommendations\. Generic, impersonal product\.

L5

Decouple Everything

Services talk via events \(Kafka\), not direct calls\. A vendor outage must NEVER take down the feed\.

One crash = full outage\. Engineers afraid to deploy\.

L6

Mobile\-First Contracts

Design APIs for mobile constraints: small payloads, cursor pagination, delta sync, gzip compression\.

Burning user mobile data\. App unusable on 4G\. Churn in Tier\-2 cities\.

L7

Privacy by Design

Location never stored raw\. EXIF stripped\. Consent\-first\. Designed before lawyers ask\.

DPDP/GDPR fines\. User trust collapse overnight\.

L8

Fail Fast, Alert Faster

P99 latency SLOs\. Alert on leading indicators\. PagerDuty from Week 1\.

Silent failures\. Users complain before engineering knows\.

L9

Feature Flags Over Deploys

Every feature behind a flag\. Canary releases\. Rollback in seconds without a deploy\.

A bad deploy kills 100% of users instead of 1%\.

L10

API Contracts are Sacred

Versioning\. Never break a client\. Deprecate with 6\-month notice\.

Forced app updates\. Clients break\. Play Store 1\-stars\.

__1\.2 The Three Time Clocks ÔÇö Every Feature Lives in One__

__Clock__

__Latency SLO__

__Examples__

__Technology__

Real\-Time Clock

< 100ms

Chat message delivery, live map update, active trip location

WebSocket, Redis Pub/Sub, Socket\.io

Near\-Real\-Time

< 2 seconds

Feed refresh, notification delivery, post goes live

Kafka consumers, CDN edge cache, FCM

Async Clock

< 5 minutes

Video transcode, memory reel, ML model scoring, email

Bull queues, AWS Lambda, background workers

__1\.3 CAP Theorem ÔÇö Per Domain Decisions__

We choose Consistency vs\. Availability explicitly per domain ÔÇö never globally\. Wrong choices here are catastrophic and irreversible at scale\.

__Domain__

__Choice__

__Reasoning__

Payment & Booking

CP ÔÇö Consistency

A double\-booking or missed commission is financial disaster\. Accept latency\.

Feed & Social Content

AP ÔÇö Availability

Users prefer a slightly stale feed over an error\. Eventual consistency is fine\.

Live Location Map

AP ÔÇö Availability

5\-second location lag is acceptable\. Showing a map error is not\.

User Authentication

CP ÔÇö Consistency

Auth must be globally consistent\. Prefer error over wrong session\.

Expense Ledger

CP ÔÇö Consistency

Money is always CP\. No exceptions\. Ever\.

Push Notifications

AP ÔÇö Availability

A duplicate notification is better than a missed one\.

Chat Messages

CP ÔÇö Consistency

Message ordering must be correct\. Out\-of\-order messages break UX irreparably\.

__2\. Complete System Architecture__

__2\.1 All 18 Microservices ÔÇö Complete Registry__

__Service__

__Port__

__Language__

__Primary DB__

__Secondary__

__Owns__

API Gateway

8000

Node\.js

ÔÇö

Redis

Routing, auth middleware, SSL termination, rate limiting, CORS

Auth Service

8001

Node\.js

MongoDB

Redis

Registration, login, JWT, OAuth Google/Apple, OTP, refresh tokens

User Service

8002

Node\.js

MongoDB

Redis cache

Profiles, followers, blocks, preferences, KYC status, travel stats

Feed Service

8003

Node\.js

MongoDB

Redis Sorted Set

Algorithm feed, trending, explore, story tray, saved posts

Post Service

8004

Node\.js

MongoDB

Elasticsearch

Post CRUD, likes, comments, shares, saves, hashtags, moderation

Story Service

8005

Node\.js

MongoDB

Redis TTL

24h stories, viewer tracking, polls, reactions, highlights

Reel Service

8006

Node\.js

MongoDB

S3 \(HLS\)

Short video CRUD, audio sync, reel discovery ranking

Media Service

8007

Go

ÔÇö

S3\+CloudFront

Upload, compress, transcode, EXIF strip, CDN routing, blur hash

Messaging Service

8008

Node\.js

MongoDB

Redis Pub/Sub

DM, group chat, read receipts, media share, voice messages

Trip Service

8009

Node\.js

MongoDB

Redis active

Trip CRUD, lifecycle state machine, collaborators, access control

Map & Location

8010

Go

MongoDB

Redis geo

Waypoints, check\-ins, geofencing, live tracking, offline tiles

Expense Service

8011

Node\.js

MongoDB \(txn\)

ÔÇö

Group expense log, split calc, settlement ledger, PDF export

Vendor Service

8012

Node\.js

MongoDB

Elasticsearch

B2B portal, catalog, KYC flow, availability calendar, reviews

Booking Service

8013

Node\.js

MongoDB

Redis locks

Reservations, inventory hold, confirmation, QR code, cancellations

Payment Service

8014

Node\.js

PostgreSQL

ÔÇö

Razorpay/Stripe, splits, commission engine, payouts, refunds

Notification Service

8015

Node\.js

MongoDB

FCM\+Redis

Push, in\-app, email, SMS, geo\-triggered alerts, digests

Search Service

8016

Node\.js

ÔÇö

Elasticsearch

Users, trips, vendors, destinations, hashtags, autocomplete

Analytics Service

8017

Python

ClickHouse

Kafka

Event ingestion, funnel tracking, ML feature store, dashboards

__2\.2 Kafka Event Bus ÔÇö All Topics__

__Topic__

__Producer__

__Consumers__

__Retention__

__Purpose__

user\.registered

Auth

User Svc, Notif, Analytics

7d

Welcome flow, profile init, onboarding funnel

post\.created

Post

Feed, Notif, Analytics, Search

30d

Feed fan\-out, follower notifications, search indexing

post\.engaged

Post

Feed, Analytics

7d

Like/save/share/view signals for ML ranking model

story\.created

Story

Notif, Analytics

24h

Story ring update, follower notification

trip\.state\_changed

Trip

Notif, Map, Analytics

30d

Drives all trip lifecycle automation

location\.checkin

Map

Notif, Vendor, Analytics

7d

Geo\-triggers, vendor push, heatmap data

media\.uploaded

Media

Post/Story/Reel Svc

3d

Signal transcode complete ÔÇö post can go live

booking\.confirmed

Booking

Payment, Notif, Vendor

90d

Settlement, confirmation, vendor dashboard update

payment\.settled

Payment

Booking, Analytics

365d

Financial audit trail, commission recording

user\.followed

User

Feed, Notif

7d

Feed graph update, follower notification

vendor\.geo\_triggered

Map/Notif

Vendor, Analytics

3d

User entered geofence ÔåÆ contextual push sent

expense\.added

Expense

Notif, Analytics

30d

Notify group of new expense, update running balances

__2\.3 API Gateway ÔÇö Full Responsibility Matrix__

__Responsibility__

__Implementation__

__Detail__

TLS Termination

AWS ALB

All traffic HTTPS\. HTTP ÔåÆ HTTPS redirect\. HSTS max\-age=31536000\.

JWT Validation

Gateway middleware

Every request validated before routing\. Public routes whitelisted explicitly\.

Rate Limiting

Redis sliding window

Per\-IP: 200/min\. Per\-user: 1000/min\. Per\-endpoint: custom\. 429 on breach\.

Request Routing

Path\-based rules

/v1/trips/\* ÔåÆ Trip Service \(8009\)\. /v1/feed/\* ÔåÆ Feed Service \(8003\)\. etc\.

Response Compression

gzip \+ Brotli

All JSON responses compressed\. ~70% payload reduction on mobile\.

API Versioning

URL prefix /v1/, /v2/

Never break old clients\. Support 2 major versions simultaneously\.

Request Tracing

UUID header

X\-Request\-ID injected on every request\. Full trace via Jaeger/X\-Ray\.

Payload Validation

Zod schemas

Malformed requests rejected at gateway before reaching any service\.

CORS Policy

Origin whitelist

Mobile apps use cert pinning\. Web dashboard strict CORS\.

Circuit Breaker

Opossum \(Node\.js\)

If service fails 5x in 10s: open circuit for 30s\. Return 503 gracefully\.

__3\. Infrastructure & Cloud Architecture__

__3\.1 AWS Stack ÔÇö Full Component Map__

__Layer__

__AWS Service__

__Config__

__Purpose__

DNS & CDN

Route 53 \+ CloudFront

Geo\-routing, 400\+ edge PoPs

Global traffic, media delivery, DDoS absorption

Load Balancer

Application Load Balancer

Multi\-AZ, health check q/10s

Layer\-7 routing, SSL termination

Containers

EKS \(Kubernetes 1\.28\)

3 node groups, 3 AZs

All 18 services\. Auto\-scaling\. Rolling deploys\.

Media Jobs

ECS Fargate \+ Lambda

Spot for batch, reserved for transcode

Video processing, image compression, thumbnail gen

Primary DB

MongoDB Atlas M30\+

Multi\-region replica set \(ap\-south\-1 primary\)

All social \+ trip data\. Atlas Search for full\-text\.

Financial DB

RDS PostgreSQL 15

Multi\-AZ, read replica

Payments, ledger, commissions\. Full ACID\.

Cache

ElastiCache Redis 7

Cluster mode, 6 shards, 3 AZs

Sessions, feed cache, pub/sub, rate limits, locks

Search

Amazon OpenSearch 2\.x

3\-node, 1 replica shard

Vendor discovery, user/trip search, autocomplete

Event Stream

Amazon MSK \(Kafka\)

3 brokers, replication=2

All async inter\-service communication

Object Storage

S3 \(Intelligent Tiering\)

Versioning on, lifecycle rules

All user media, vendor docs, KYC files

Job Queues

SQS \+ Bull \(Redis\)

DLQ enabled, retry=3x

Email, video processing, settlement jobs

Secrets

AWS Secrets Manager

Auto\-rotation q/30d

DB passwords, API keys, payment credentials

Monitoring

CloudWatch \+ Prometheus

1\-minute granularity

Infra \+ app metrics, custom dashboards

Tracing

AWS X\-Ray \+ Jaeger

100% dev, 5% prod sampling

Distributed traces across all 18 services

Alerts

PagerDuty \+ SNS

On\-call rotation, escalation

SLO breach, error spikes, P99 latency threshold

CI/CD

GitHub Actions \+ ArgoCD

PR checks ÔåÆ staging ÔåÆ prod

Automated testing, image build, Helm chart deploy

__3\.2 Kubernetes ÔÇö Deployment Strategies__

__Strategy__

__When Used__

__Rollback Time__

__Risk Level__

Rolling Update

All standard deploys

~2 min \(scale down new pods\)

Minimal ÔÇö old pods serve during deploy

Blue/Green

Major version, DB migrations

< 30 sec \(DNS/ALB flip\)

Zero downtime, 2x infra cost briefly

Canary Release

New feed algorithm, ML model

Instant \(0% ÔåÆ 1% ÔåÆ 5% ÔåÆ 100%\)

Only 1ÔÇô5% of users see new version first

Feature Flags

All new product features

Instant \(Redis toggle\)

Zero deploy\. Toggle per user/cohort/country\.

__3\.3 Disaster Recovery Matrix__

__Scenario__

__RTO__

__RPO__

__Recovery Action__

Single AZ failure

< 2 min

0

EKS auto\-reschedules pods to healthy AZs\. ALB reroutes instantly\.

Primary DB node failure

< 30 sec

0

MongoDB Atlas auto\-promotes replica\. No manual action\.

Full region failure

< 15 min

< 5 min

Route 53 health check failover to ap\-southeast\-1 \(Singapore\)\.

Kafka broker failure

< 1 min

0

MSK replicates to 2 other brokers\. Consumers catch up from offset\.

Redis cluster failure

< 2 min

Cache loss only

Rebuild from DB\. Feed temporarily slower, not broken\.

CDN origin failure

< 5 min

N/A \(static\)

CloudFront serves cached assets\. S3 as backup origin\.

Mass data corruption

< 60 min

< 15 min

Point\-in\-time restore from Atlas continuous backup\.

__4\. Complete Database Schema Design__

__4\.1 Database Selection ÔÇö Per Domain__

__Domain__

__Database__

__Reason__

Social & Trips

MongoDB

Flexible nested docs, geospatial indexes, horizontal sharding, Atlas Search

Financial Records

PostgreSQL

ACID transactions, FK constraints, audit triggers ÔÇö money demands relational integrity

Feed Cache

Redis Sorted Sets

O\(log N\) range queries on score\. Perfect for ranked post IDs with TTL\.

Sessions & Locks

Redis String/Hash

Microsecond reads\. Distributed TTL\. Cluster\-safe atomic operations\.

Search Index

Elasticsearch

Inverted index for full\-text\. Geo\-distance sort\. Autocomplete suggester\.

Event Log

Kafka \(7ÔÇô30d retention\)

Append\-only, partitioned, replayable\. Source of truth for all domain events\.

Analytics & ML Features

ClickHouse

Columnar\. Billion\-row scans in seconds\. Funnel, cohort, retention queries\.

__4\.2 users ÔÇö MongoDB Schema__

__Field__

__Type__

__Index__

__Description__

\_id

ObjectId

PK

Auto\-generated primary key

username

String

Unique

3ÔÇô30 chars\. /^\[a\-z0\-9\_\.\]\+$/\. URL\-safe\. Lowercase enforced\.

display\_name

String

Text index

Full display name\. Max 60 chars\.

email

String

Unique sparse

Field\-level encrypted\. Normalized lowercase\.

phone

String

Unique sparse

E\.164 format\. Encrypted\. Verified via OTP\.

phone\_verified

Boolean

ÔÇö

Must be true before booking actions allowed\.

password\_hash

String

ÔÇö

bcrypt cost=12\. Never returned in any API response\.

avatar\_url

String

ÔÇö

CDN URL\. Two sizes: 150x150 and 400x400\.

bio

String

ÔÇö

Max 160 chars\. @mentions and \#hashtags parsed on save\.

follower\_count

Number

ÔÇö

Denormalized\. Atomic $inc/$dec\. Never query follower array for count\.

following\_count

Number

ÔÇö

Denormalized\. Same pattern\.

post\_count

Number

ÔÇö

Denormalized\. Incremented on post creation\.

travel\_stats

Object

ÔÇö

\{ countries:\[\], cities:\[\], total\_km:0, trips\_completed:0 \}

preferences

Object

ÔÇö

\{ budget\_style, interests:\[\], home\_city: GeoJSON Point \}

kyc\_status

Enum

Compound

'none'|'pending'|'verified'|'rejected'

traveler\_rank

Object

ÔÇö

\{ xp:0, level:'Explorer', badges:\[\], streak\_days:0 \}

privacy\_settings

Object

ÔÇö

\{ location\_sharing, profile\_visibility, story\_audience \}

blocked\_users

ObjectId\[\]

ÔÇö

Max 500\. Checked on all social interactions\.

device\_tokens

Object\[\]

ÔÇö

\[\{ token, platform:'ios|android', last\_seen \}\]

auth\_providers

Object\[\]

ÔÇö

\[\{ provider:'google|apple|phone', provider\_id \}\]

is\_vendor

Boolean

Sparse

Unlocks vendor portal when true\.

account\_status

Enum

ÔÇö

'active'|'suspended'|'deactivated'|'banned'

last\_active\_at

Date

TTL candidate

Updated every authenticated request\.

created\_at

Date

ÔÇö

Immutable\. Set at registration\.

__  Ôûî Indexes: username \(unique\), email \(unique\), phone \(unique\), preferences\.home\_city \(2dsphere\), account\_status\+created\_at \(compound\), text on display\_name\+bio  __

__4\.3 trips ÔÇö MongoDB Schema__

__Field__

__Type__

__Index__

__Description__

\_id

ObjectId

PK

ÔÇö

slug

String

Unique

URL\-safe: 'goa\-june\-a3f9'\. Used in share links\.

title

String

Text

Max 80 chars\. Used in feed previews and search\.

admin\_id

ObjectIdÔåÆusers

Compound

Trip creator\. Can transfer admin role once\.

collaborators

Object\[\]

ÔÇö

\[\{ user\_id, role:'co\-admin|member|viewer', status:'invited|active|left', joined\_at, contribution\_score \}\]

max\_collaborators

Number

ÔÇö

Default 20\. Admin configurable up to 50\.

join\_requests

Object\[\]

ÔÇö

\[\{ user\_id, message, requested\_at, status:'pending|approved|rejected' \}\]

origin

Object

2dsphere

GeoJSON Point \+ label \+ place\_id

destination

Object

2dsphere

GeoJSON Point \+ label \+ place\_id

waypoints

Object\[\]

ÔÇö

\[\{ order, location:GeoJSON, label, travel\_mode, est\_arrival, actual\_arrival, linked\_post\_ids:\[\] \}\]

dates

Object

Compound

\{ start:ISODate, end:ISODate, timezone:'Asia/Kolkata' \}

duration\_days

Number

ÔÇö

Computed and stored: \(end \- start\) in days\.

budget

Object

ÔÇö

\{ estimated, actual, currency:'INR', per\_person, breakdown:\{ transport, accommodation, food, activities \} \}

status

Enum

Compound

'draft'|'planning'|'active'|'completed'|'archived'

visibility

Enum

Index

'private'|'friends\_only'|'public'

tags

String\[\]

Text\+Array

\['beach','budget','adventure'\]\. Max 10\.

post\_count

Number

ÔÇö

Denormalized\. Posts tagged to this trip\.

total\_km

Number

ÔÇö

Computed total route distance across all waypoints\.

group\_chat\_id

ObjectIdÔåÆchats

ÔÇö

Auto\-created group chat reference\.

packing\_list

Object\[\]

ÔÇö

\[\{ item, assigned\_to:user\_id, packed:false, added\_by \}\]

ai\_itinerary

Object\[\]

ÔÇö

\[\{ day, items:\[\{ time, activity, place\_id, est\_cost, votes:\{up:\[\],down:\[\]\} \}\] \}\]

expense\_summary

Object

ÔÇö

\{ total\_spent, per\_person\_share, settlements:\[\{ from, to, amount, settled \}\] \}

safety

Object

ÔÇö

\{ sos\_contacts:\[\{name,phone\}\], checkin\_interval\_hours, emergency\_mode:false \}

memory\_reel\_url

String

ÔÇö

CDN URL of auto\-generated highlight reel\.

completed\_at

Date

ÔÇö

Set when status ÔåÆ completed\.

created\_at

Date

ÔÇö

Immutable\.

__  Ôûî Indexes: admin\_id\+status, destination \(2dsphere\), dates\.start \(upcoming trips\), status\+visibility \(public discovery\), text on title\+description\+tags  __

__4\.4 posts ÔÇö MongoDB Schema__

__Field__

__Type__

__Index__

__Description__

\_id

ObjectId

PK

ÔÇö

author\_id

ObjectIdÔåÆusers

Compound

Required\. Immutable after creation\.

trip\_id

ObjectIdÔåÆtrips

Sparse

Optional\. Links post to trip timeline\. Immutable\.

waypoint\_index

Number

ÔÇö

Which waypoint of the trip this post is tagged to\.

type

Enum

Index

'post'|'reel'|'story'|'trip\_log'

media

Object\[\]

ÔÇö

\[\{ url, thumbnail\_url, blur\_hash, type:'photo|video', width, height, duration\_sec, aspect\_ratio \}\]\. Max 10\.

caption

String

Text

Max 2200 chars\. @mentions and \#hashtags extracted on save\.

hashtags

String\[\]

Array\+Text

Lowercase, no \#\. Max 30 per post\.

mentions

ObjectId\[\]

ÔÇö

User IDs\. Triggers mention notification\.

location

Object

2dsphere

GeoJSON Point\. EXIF extracted then stripped from media file\.

location\_label

String

ÔÇö

'Calangute Beach, Goa'

place\_id

String

ÔÇö

Google Places ID for structured data\.

tagged\_vendors

ObjectId\[\]

ÔÇö

Vendor IDs tagged\. Attribution \+ vendor notification\.

tagged\_users

ObjectId\[\]

ÔÇö

Users tagged in photo/video\.

like\_count

Number

ÔÇö

Denormalized\. Atomic $inc/$dec\.

comment\_count

Number

ÔÇö

Denormalized\.

save\_count

Number

ÔÇö

Denormalized\.

share\_count

Number

ÔÇö

Denormalized\.

view\_count

Number

ÔÇö

Redis counter ÔåÆ async sync to MongoDB q/5min\.

engagement\_score

Number

Compound

ML\-computed\. Recomputed q/15min\. Feed ranking key\.

hide\_like\_count

Boolean

ÔÇö

Author preference\. UI hides count but stored\.

comments\_disabled

Boolean

ÔÇö

Author can disable comments post\-publish\.

expires\_at

Date

TTL index

Stories only: now \+ 24h\. Null for permanent posts\.

deleted\_at

Date

Sparse

Soft delete\. Never hard\-deleted \(trip log integrity preserved\)\.

moderation

Object

ÔÇö

\{ status:'clean|flagged|removed', ai\_scores:\{ nsfw, violence \}, reviewed\_by \}

created\_at

Date

Compound

Immutable\. Primary sort key\.

__  Ôûî Indexes: author\_id\+created\_at desc, trip\_id\+created\_at \(timeline\), location \(2dsphere\), hashtags \(multikey\), expires\_at \(TTL sparse\), engagement\_score\+created\_at \(feed ranking\)  __

__4\.5 vendors ÔÇö MongoDB Schema__

__Field__

__Type__

__Index__

__Description__

\_id

ObjectId

PK

ÔÇö

owner\_user\_id

ObjectIdÔåÆusers

Index

User account that manages this vendor profile\.

business\_name

String

Text

Max 100 chars\.

category

Enum

Index

'hotel'|'cab'|'tour\_guide'|'restaurant'|'activity'|'shop'

description

String

Text

Max 1000 chars\.

media

Object\[\]

ÔÇö

Business photos/videos\. Max 20\.

location

Object

2dsphere

\{ type:'Point', coordinates, address, city, state, pincode \}

geofence\_radius\_km

Number

ÔÇö

Geo\-trigger radius\. Default 5km, max 50km\.

service\_area

Object

2dsphere Polygon

For cab/tour vendors with wider coverage\.

catalog

Object\[\]

ÔÇö

\[\{ id, name, description, price, currency, unit:'per\_night|per\_trip|per\_person', availability\_calendar, active \}\]

operating\_hours

Object

ÔÇö

\{ mon:\{ open:'09:00', close:'21:00' \} \} per day\.

rating

Object

ÔÇö

\{ average:4\.7, count:234, breakdown:\{ 5:180, 4:40, 3:10, 2:2, 1:2 \} \}

kyc

Object

ÔÇö

\{ status, aadhaar\_verified, gst\_number, pan\_verified, reviewed\_at \}

bank\_details\_ref

String

ÔÇö

Secrets Manager reference\. Never store raw bank data\.

subscription\_tier

Enum

Index

'free'|'basic'|'growth'|'premium'

is\_active

Boolean

Index

Soft toggle\. Deactivate without losing data\.

booking\_count

Number

ÔÇö

Total confirmed bookings\. Social proof\.

response\_rate

Number

ÔÇö

% of requests responded to within 24h\.

created\_at

Date

ÔÇö

ÔÇö

__  Ôûî Indexes: location \(2dsphere\), service\_area \(2dsphere\), category\+is\_active\+rating\.average, subscription\_tier, text on business\_name\+description\+city  __

__4\.6 messages \+ conversations ÔÇö MongoDB Schema__

__Field__

__Type__

__Description__

conversations\.\_id

ObjectId

Primary key of the conversation thread

conversations\.type

Enum

'direct'|'trip\_group'|'support'

conversations\.participants

ObjectId\[\]

User IDs in the conversation\. Max 50 for group\.

conversations\.trip\_id

ObjectId

For trip groups ÔÇö links to trip document\.

conversations\.last\_message

Object

\{ content\_preview, sender\_id, sent\_at \} ÔÇö shown in chat list

conversations\.unread\_counts

Object

\{ user\_id: count \} ÔÇö denormalized per participant

messages\.conversation\_id

ObjectId

FK to conversation\. Primary query key \(indexed\)\.

messages\.sender\_id

ObjectId

Immutable\. Author\.

messages\.type

Enum

'text'|'image'|'video'|'voice'|'location\_pin'|'post\_share'|'trip\_invite'|'system'

messages\.content

String

For text\. Max 4000 chars\.

messages\.media\_url

String

CDN URL for image/video/voice attachments\.

messages\.reply\_to\_id

ObjectId

Thread reply reference\.

messages\.reactions

Object\[\]

\[\{ user\_id, emoji \}\]\. Deduplicated per user\.

messages\.read\_by

Object\[\]

\[\{ user\_id, read\_at \}\]\. Populated as members read\.

messages\.deleted\_for

ObjectId\[\]

Soft\-delete per user\. Each user sees their own view\.

messages\.created\_at

Date

Immutable\. Sort key\.

__4\.7 bookings ÔÇö MongoDB Schema__

__Field__

__Type__

__Description__

\_id

ObjectId

Primary key

trip\_id

ObjectIdÔåÆtrips

Trip this booking belongs to

user\_id

ObjectIdÔåÆusers

User who initiated the booking

vendor\_id

ObjectIdÔåÆvendors

Vendor being booked

catalog\_item\_id

String

Which catalog item \(room type, tour, etc\.\)

guests

Object\[\]

\[\{ user\_id, name, age \}\] ÔÇö group booking participants

dates

Object

\{ check\_in, check\_out \} or \{ date, duration\_hours \}

amount

Object

\{ subtotal, platform\_fee, tax, total, currency:'INR' \}

payment\_id

String

Razorpay/Stripe payment ID

status

Enum

'pending\_payment'|'confirmed'|'active'|'completed'|'cancelled'|'refunded'

qr\_code\_url

String

CDN URL of booking QR\. Shown at venue entry\.

cancellation\_policy

Object

\{ deadline, refund\_percent \} ÔÇö from vendor catalog at time of booking

review\_id

ObjectId

Populated after verified review is submitted

created\_at

Date

Immutable

confirmed\_at

Date

Set when payment confirmed

__4\.8 PostgreSQL ÔÇö payments \(Financial Ledger\)__

__Table / Field__

__Type__

__Constraints__

__Description__

payments\.id

UUID

PK

Primary key

payments\.booking\_id

UUID

FKÔåÆbookings, NOT NULL

Reference to MongoDB booking \(cross\-DB ref\)

payments\.user\_id

UUID

NOT NULL, INDEX

Payer

payments\.vendor\_id

UUID

NOT NULL, INDEX

Recipient vendor

payments\.gross\_amount

DECIMAL\(12,2\)

NOT NULL, CHECK > 0

Total charged to user

payments\.platform\_fee

DECIMAL\(12,2\)

NOT NULL

Trip Party commission \(5ÔÇô8%\)

payments\.vendor\_payout

DECIMAL\(12,2\)

NOT NULL

Amount vendor receives

payments\.tax\_amount

DECIMAL\(12,2\)

NOT NULL

GST \(18% on platform fee\)

payments\.currency

CHAR\(3\)

NOT NULL, DEFAULT 'INR'

ISO 4217 code

payments\.gateway

ENUM

NOT NULL

'razorpay'|'stripe'|'upi'

payments\.gateway\_txn\_id

VARCHAR\(100\)

UNIQUE

Gateway's transaction reference

payments\.status

ENUM

NOT NULL, INDEX

'initiated'|'captured'|'settled'|'refunded'|'failed'

payments\.settled\_at

TIMESTAMPTZ

NULLABLE

T\+1 settlement timestamp

payments\.created\_at

TIMESTAMPTZ

NOT NULL, DEFAULT NOW\(\)

Immutable

settlements\.id

UUID

PK

Payout record to vendor bank

settlements\.payment\_id

UUID

FKÔåÆpayments

Which payment this settles

settlements\.amount

DECIMAL\(12,2\)

NOT NULL

Net payout to vendor

settlements\.bank\_ref

VARCHAR\(100\)

ÔÇö

NEFT/IMPS reference number

settlements\.status

ENUM

ÔÇö

'pending'|'processing'|'completed'|'failed'

__5\. Feed Algorithm ÔÇö Instagram\-Grade Engineering__

__  Ôûî Instagram processes 100M\+ posts/day through this exact pipeline structure\. We build the same\.  __

The feed algorithm is not one thing ÔÇö it is a 6\-stage pipeline, each with its own infrastructure, time budget, and failure mode\. Instagram calls these: Candidate Generation ÔåÆ Scoring ÔåÆ Ranking ÔåÆ Filtering ÔåÆ Blending ÔåÆ Personalization\.

__5\.1 Feed Pipeline ÔÇö 6 Stages__

__Stage__

__Name__

__What It Does__

__Infra__

__Time Budget__

1

Candidate Generation

Fetch ~500 candidate posts: followed users \(chronological\) \+ interest graph \+ trending \+ saved authors

MongoDB \+ Redis Sorted Set

< 25ms

2

Feature Extraction

For each candidate: fetch like/save/comment counts, view completion rate, author relationship score, recency

Redis Hash \+ ClickHouse

< 20ms

3

ML Ranking

Score all 500 candidates using XGBoost model\. Return top 100\.

TF Serving \(ONNX model, GPU\)

< 35ms

4

Filtering

Remove: seen posts \(Bloom filter\), blocked users, removed content, expired stories

Redis Bloom Filter

< 8ms

5

Blending

Inject: 1 trip post per 8 organic, 1 sponsored per 20, story tray, suggested users

Business rules engine

< 5ms

6

Personalization

Re\-rank top 10 based on: time\-of\-day patterns, current location, active trip context

Redis user session

< 7ms

TOTAL

ÔÇö

ÔÇö

< 100ms P50\. < 200ms P99

__5\.2 ML Ranking Signal Weights__

Weights trained via XGBoost on historical engagement\. Configurable via feature flags ÔÇö no deploy needed to tune\.

__Signal__

__Weight__

__Type__

__Collection Method__

Save \(bookmark\)

0\.35

Strong positive

Event: post\.saved ÔÇö strongest intent signal

Share to DM or Story

0\.28

Strong positive

Event: post\.shared ÔÇö user vouches to others

Comment \(text typed\)

0\.25

Strong positive

Event: comment\.created ÔÇö active engagement

Video completion > 80%

0\.30

Strong positive

Client event: video\.completed ÔÇö high attention

Like

0\.15

Moderate positive

Event: post\.liked ÔÇö low\-friction signal

Profile visit from post

0\.18

Moderate positive

Event: profile\.visited\_from\_post

Scroll past in < 0\.5s

ÔêÆ0\.25

Negative

Client event: feed\.scroll\_past ÔÇö content irrelevant

Post reported

ÔêÆ1\.00

Hard negative

One report ÔåÆ immediate rank penalty

Author is close friend

0\.40

Relationship boost

Mutual DM history \+ frequent likes

Same city as user

0\.20

Context signal

Post location within 50km of user's current location

User has active trip

0\.50

Context boost

If user trip status=ACTIVE ÔåÆ boost travel content

Recency decay

Variable

Time signal

Score ├ù e^\(ÔêÆ0\.1 ├ù hours\_since\_posted\)

__5\.3 Feed Delivery ÔÇö Fan\-Out Strategy__

__User Type__

__Strategy__

__How It Works__

< 10,000 followers

Push on write

Post created ÔåÆ Kafka ÔåÆ worker pushes post\_id into each follower's Redis Sorted Set\. Score = ranking\_score\. TTL=24h\.

> 10,000 followers

Pull on read

Feed service merges influencer posts at read time\. Avoids writing to millions of Sorted Sets\.

App opened \(cold start\)

Delta fetch

Fetch only posts newer than last\_seen\_cursor\. 80% smaller payload\.

Infinite scroll

Cursor pagination

Cursor = last post's score\. No offset\. Prevents duplicates on re\-rank between pages\.

__5\.4 Feed Cache Keys ÔÇö Redis Structure__

__Key Pattern__

__Type__

__TTL__

__Content__

feed:\{user\_id\}

Sorted Set

24h

Post IDs, scored by ranking\. Top 500\. ZREVRANGE for pagination\.

post:meta:\{post\_id\}

Hash

1h

\{ author\_id, media\_url, caption\_preview, like\_count, type \} ÔÇö avoids DB hit

seen:\{user\_id\}

Bloom Filter

7d

Post IDs shown\. False positive rate 0\.1%\. 10MB per 10M users\.

trending:tags:\{YYYYMMDD\}

Sorted Set

24h

Hashtag ÔåÆ post count\. Top 20 for Explore tab\.

user:features:\{user\_id\}

Hash

30min

Cached ML features: interest vector, activity level, time\-of\-day pattern

story:active:\{user\_id\}

List

24h

Story IDs from followed users\. Ordered by recency for story tray\.

influencer:posts:\{user\_id\}

Sorted Set

6h

Pre\-computed ranked posts for users with 10K\+ followers \(pull model\)

__6\. Media Pipeline ÔÇö Photo, Video, Reels, Stories__

__  Ôûî Instagram processes 100M photos/day\. Netflix streams 15% of global internet traffic\. We build the same pipeline\.  __

__6\.1 Photo Upload & Processing Flow__

__Step__

__Action__

__Service__

__Output__

1

Device captures photo\. React Native pre\-processes: EXIF GPS extracted ÔåÆ structured metadata JSON\. EXIF stripped from file\. Compressed to < 3MB JPEG\.

Client \(device\)

Compressed JPEG \+ metadata JSON

2

Client requests pre\-signed S3 URL for direct upload\.

Media Service ÔåÆ S3

Pre\-signed URL, valid 5 minutes

3

Client uploads directly to S3\. Progress shown to user\. Backend never sees raw bytes\.

S3 Direct PUT

Raw file in s3://raw/\{uuid\}

4

S3 event triggers Lambda ÔåÆ publishes media\.uploaded Kafka event\.

Lambda ÔåÆ Kafka

Event: \{ s3\_key, user\_id, type \}

5a

Worker resizes to 4 sizes: 150px \(avatar\), 480px, 1080px, 2048px\.

Fargate \(Sharp\)

4 JPEG variants in S3

5b

Generate BlurHash ÔÇö 26\-char compact visual placeholder shown while image loads\.

BlurHash lib

String stored in post doc

5c

Generate WebP versions of each size\. ~30% smaller than JPEG\.

Sharp

WebP variants in S3

5d

Run AWS Rekognition: detect NSFW, violence, text\. Scores stored in moderation field\.

Rekognition

Confidence scores

5e

Auto\-flag if NSFW > 0\.85\. Hold from feed\. Alert moderation queue\.

Moderation svc

Moderation action

6

Worker publishes media\.processed\. Post Service makes post live\. Feed fan\-out begins\.

Kafka ÔåÆ Post Svc

Post visible in feed

__6\.2 Video / Reel Processing ÔÇö HLS Adaptive Streaming__

We use HTTP Live Streaming \(HLS\) ÔÇö the same standard Netflix, YouTube, and Instagram use\. The player auto\-selects quality based on the user's current bandwidth\.

__Step__

__Action__

__Output__

1

Device records\. Client trims to 15ÔÇô90s \(Reel\) or 60s \(post video\)\. Pre\-compressed H\.264, < 50MB\.

Trimmed MP4

2

Multipart pre\-signed S3 upload\. 5MB chunks\. Client shows upload progress bar\.

Raw MP4 in S3

3

Lambda triggers AWS MediaConvert transcode job\.

Transcode job created

4a

Generate HLS stream at 3 quality tiers: 360p@500kbps, 720p@1\.5Mbps, 1080p@4Mbps\.

m3u8 playlist \+ \.ts segment files in S3

4b

Generate static thumbnail at frame 0 \+ best\-frame \(highest visual entropy via perceptual hash\)\.

2x JPEG thumbnails

4c

Generate 3\-second animated WebP preview at 6fps for autoplay in feed\. < 500KB\.

Animated WebP

4d

Extract audio waveform data for voice messages\. Used for waveform visualization in chat\.

Float32 array JSON

5

Rekognition Video: async per\-keyframe NSFW scan\. SQS callback on job complete\.

Moderation scores

6

CloudFront as HLS origin\. Client player \(Video\.js or ExoPlayer\) fetches m3u8 ÔåÆ auto\-selects quality tier\.

Adaptive bitrate playback

7

media\.processed event published\. Post goes live\.

Post visible in feed

__6\.3 Stories Architecture ÔÇö The Hard Parts__

__Component__

__Implementation__

__Engineering Detail__

24h TTL Expiry

MongoDB TTL index

Expires\_at field\. MongoDB auto\-deletes docs\. CDN Cache\-Control matches TTL\.

View Tracking

Redis HyperLogLog

HLL per story\_id\. Approximate unique viewer count, < 1% error at scale\. O\(1\) insert\. Memory: 12KB per story\.

Sequential Viewing

Redis List

story:queue:\{viewer\_id\} ÔÇö ordered unseen story IDs\. LPOP for sequential auto\-play\.

Story Ring Indicator

Redis Set

seen\_stories:\{user\_id\} set\. Ring grey if story\_id in set\. O\(1\) lookup\. Critical for UX\.

Polls & Questions

MongoDB sub\-doc

\{ type:'poll', options:\[\{ text, votes \}\] \}\. Vote = atomic $inc\. Author sees results real\-time\.

Close Friends

Redis Set

close\_friends:\{user\_id\} ÔÇö IDs of close friends\. Story with audience='close\_friends' filtered at delivery\.

Highlights

Posts collection

Saved stories re\-indexed as type='highlight'\. No TTL\. Permanent profile content\.

Archive

S3 Glacier

30 days post\-expiry, media moved to Glacier Instant Retrieval\. User can restore to Highlights\.

__6\.4 CDN & Media Delivery Strategy__

__Media Type__

__Delivery__

__Cache TTL__

__Optimization__

Profile Avatar

CloudFront \+ S3

7 days

Aggressive cache\. URL includes hash ÔÇö cache\-busted on update\.

Feed Photos

CloudFront \+ S3

24 hours

BlurHash shown instantly\. Progressive JPEG\. WebP for Android\.

Reels / Videos

CloudFront HLS

Segments: 24h

Adaptive bitrate\. Pre\-buffer next reel on infinite scroll\.

Stories

CloudFront \+ S3

1 hour

Pre\-fetch next 3 stories on story open\. Minimize tap\-to\-load\.

Map Tiles

S3 \+ CloudFront

30 days

Pre\-generate tiles for top 50 destinations\. Offline pack download\.

Vendor Photos

CloudFront \+ S3

48 hours

WebP \+ lazy\-load below fold\. Blur placeholder\.

__7\. Notification System ÔÇö WhatsApp / Instagram Grade__

__7\.1 Notification Types & Channels__

__Event__

__Channel__

__Priority__

__Grouping Rule__

__Delivery SLA__

New follower

In\-app \+ Push

Medium

Batch: '5 people followed you today'

< 2s

Post liked

In\-app

Low

Batch: '43 people liked your post'

< 5s \(batched q/15min\)

Post comment

In\-app \+ Push

High

Show first comment, count others

< 1s

@mention in post/comment

In\-app \+ Push

High

Individual ÔÇö never batched

< 1s

DM received

Push \+ In\-app

Critical

Individual\. Lock\-screen preview\.

< 500ms

Trip invite

Push \+ In\-app \+ SMS

High

Individual\. Deep link to trip\.

< 2s

Trip state change

Push \+ In\-app

High

e\.g\., 'Your Goa trip is now ACTIVE\!'

< 2s

Geo vendor trigger

Push

High

Individual, geo\-contextual, max 3/day/user

< 5s of entering geofence

Booking confirmed

Push \+ In\-app \+ Email

Critical

Individual\. Includes QR code link\.

< 3s

Expense added

In\-app \+ Push

Medium

'Rahul added Ôé╣2400 hotel expense'

< 3s

SOS activated

SMS \+ Push to contacts

Critical

Individual\. Never batched\. Phone call fallback\.

< 10s

Payment settled

Push \+ Email

Medium

'Your Goa trip expenses are settled'

< 5s

__7\.2 Notification Pipeline Architecture__

__Stage__

__Action__

__Tech__

__Detail__

1

Service publishes event to Kafka

Kafka

e\.g\., post\.commented by User A on Post B

2

Notification worker consumes event, checks user preferences

Node\.js consumer

If user has muted this type or sender, skip\. Check do\-not\-disturb hours\.

3

Fetch recipient device tokens from User Service \(Redis cache\)

Redis

device\_tokens array from user document\. Multi\-device fan\-out\.

4

Determine grouping: immediate vs\. batched

Business logic

High priority ÔåÆ immediate\. Low priority ÔåÆ batch buffer in Redis for 15min digest\.

5

Render notification payload: title, body, deep link, image URL

Template engine

Localized strings\. Deep link: tripparty://post/\{id\} etc\.

6

Dispatch to FCM \(Android\) / APNs \(iOS\)

FCM \+ APNs

Platform\-specific payload format\. Badge count included\.

7

Log delivery receipt, store in notifications collection

MongoDB

delivery\_status: 'sent'|'delivered'|'opened'

8

Email via SES for critical types \(booking, SOS, payment\)

AWS SES

HTML template\. Tracked opens for analytics\.

9

SMS via Twilio for SOS and OTP only

Twilio

Rate limited\. Emergency SOS has no rate limit\.

__7\.3 Anti\-Spam & Rate Limiting Rules__

__Rule__

__Limit__

__Scope__

__Exception__

Max push per user per day

20 push notifications

Per user

SOS, DM, booking confirmations exempt

Geo vendor trigger max

3 per day

Per user

Cannot be exceeded\. Vendors cannot pay to bypass\.

Like notification batching

Batch after 5 likes

Per post

Unbatch if from a close friend

DM throttle

Max 5 push/hour

Per conversation

All DMs still delivered in\-app

Email frequency

Max 5/day

Per user

Transactional \(booking/payment\) exempt

Do Not Disturb

User\-set hours respected

Per user

SOS always overrides DND

__8\. Search & Discovery Engine__

__8\.1 Elasticsearch Index Definitions__

__Index__

__Indexed Fields__

__Query Type__

__Use Case__

users

username, display\_name, bio, travel\_stats\.cities

Multi\-match \+ fuzzy

'Find people' search, @mention autocomplete

trips

title, description, tags, destination\.label, origin\.label

Multi\-match \+ geo\_distance

Trip discovery, public trip search

vendors

business\_name, description, category, city, tags

Multi\-match \+ geo\_distance \+ term filter

Vendor search, marketplace browse

posts

caption, hashtags, location\_label

Multi\-match \+ range \(date\)

Hashtag search, location content browse

destinations

name, country, state, aliases\[\]

Completion suggester

Trip creation destination autocomplete

hashtags

tag, post\_count

Completion suggester \+ term

Hashtag autocomplete in caption editor

__8\.2 Search Query Pipeline__

__Step__

__Action__

__Detail__

1

Query received at Search Service\. Sanitize input\. Strip special chars\.

Max 100 chars\. Timeout 500ms\. Log query to Kafka for analytics\.

2

Determine query intent: user / trip / vendor / hashtag / destination

Keyword rules \+ ML classifier\. e\.g\., '\#goa' ÔåÆ hashtag\. '@rahul' ÔåÆ user\. 'Hotels near Colaba' ÔåÆ vendor\+geo\.

3

Execute Elasticsearch multi\-search across relevant indexes

Parallel requests\. Geo boost if user location available\. Fuzzy matching enabled \(edit distance 1ÔÇô2\)\.

4

Merge and re\-rank results

Boost verified accounts, premium vendors, high\-engagement trips\. Apply personalization signals\.

5

Filter: blocked users, removed content, private trips \(non\-collaborator\)

Server\-side always\. Never trust client filtering\.

6

Return paginated results with cursor\. Max 20 results per page\.

Include: entity type, preview thumbnail, relevance meta\. Deep link included\.

__8\.3 Trending & Explore Tab__

__Feature__

__Data Source__

__Update Frequency__

__Display Logic__

Trending Hashtags

Kafka stream ÔåÆ Redis Sorted Set

Real\-time \(sliding 24h window\)

Top 20 by post count change velocity, not absolute count

Trending Destinations

Trip creation events ÔåÆ ClickHouse

Hourly

Top cities where trips are being created right now

Suggested Users

User graph \+ interest similarity

Daily \(ML batch job\)

Users you don't follow but share 3\+ mutual followers \+ similar interests

Nearby Posts

Posts index geo\_distance query

Per\-request \(no cache\)

Posts within 50km of user current location\. Recent only \(< 7 days\)\.

Discover Trips

Public trips \+ engagement score

Every 15 min

Public trips tagged to destinations near user's home\_city or active trip

Promoted Destinations

Vendor/tourism board sponsored

Real\-time

Capped at 2 per Explore page\. Labeled 'Sponsored'\.

__9\. Trip Engine ÔÇö Lifecycle & State Machine__

__9\.1 Trip State Machine ÔÇö All Transitions__

__From State__

__Event Trigger__

__ÔåÆ New State__

__Automated Actions Fired__

\(none\)

Admin creates trip

DRAFT

Trip Hub created\. Slug generated\. Invite links activated\. Group chat created\.

DRAFT

Admin publishes trip

PLANNING

Collaborator invites sent\. AI Planner activated\. Packing list pre\-populated\. Budget board unlocked\.

PLANNING

Start date reached \+ admin confirms

ACTIVE

Live map enabled\. Geo\-triggers armed for first waypoint\. Marketplace context set\. Trip\_id linked to all new posts\.

ACTIVE

Admin marks complete OR end date \+ 24h

COMPLETED

Live tracking disabled\. Memory Reel generation job queued\. Expense settlement summary sent\. Reviews unlocked\.

COMPLETED

30 days elapsed OR admin archives

ARCHIVED

Read\-only mode enforced\. Public timeline visible\. Media moved to cold CDN tier\.

ANY STATE

Admin cancels trip

CANCELLED

All pending bookings cancelled \(refund flow triggered\)\. All collaborators notified\.

DRAFT/PLANNING

Admin deletes trip

DELETED

Soft delete\. All collaborators removed\. Media references retained for 30 days\.

__9\.2 Trip Hub ÔÇö Full Feature Matrix__

__Feature__

__Phase__

__Who Can Use__

__Technical Detail__

Group Chat

Planning\+

All collaborators

Auto\-created conversation with trip\_id\. Type='trip\_group'\. All trip system messages injected here\.

AI Itinerary Planner

Planning\+

All members \(vote\), Admin \(commit\)

Calls Claude/GPT API with: destination, dates, budget, interests\. Returns day\-by\-day plan\. Members vote on items\.

Shared Packing List

Planning\+

All collaborators

Items assigned to members\. AI pre\-populates for destination\+duration\. Offline\-available via SQLite\.

Budget Board

Planning\+

All members \(view\), Admin \(set\)

Input per\-person budget\. Track actual vs\. estimated in real\-time via Expense Service\.

Collaborative Map

Planning\+

Admin \(edit\), All \(view\)

Drag\-and\-drop waypoint reordering\. Travel mode selection\. Route preview\.

Join Request Dashboard

Always

Admin only

Accept/reject join requests\. View requester profile\. Set role on approval\.

Live Location Sharing

Active only

Opt\-in per member

WebSocket\-based\. Updates q/30s when enabled\. Auto\-stops after 12h or trip ends\.

Trip Timeline / Post Log

Active\+

All members \(view\), Authors \(post\)

Chronological immutable log of all tagged posts\. Filter by member or waypoint\.

Expense Tracker

Active\+

All collaborators

Add expense ÔåÆ select who paid ÔåÆ split method \(equal/custom/%\)\. Running balance updated instantly\.

Vendor Booking Panel

Active only

All collaborators

Geo\-suggested vendors\. Book directly\. Group booking flow\. QR confirmation\.

Safety Dashboard

Active only

Admin \(configure\), All \(trigger\)

SOS button\. Check\-in confirmation\. Trusted contact links\. Emergency mode toggle\.

Memory Reel Preview

Completed

All collaborators

Auto\-assembled reel\. Edit trim points\. Download\. Share to feed as 'Trip Memory' post type\.

Trip Summary Report

Completed

All collaborators

Total spent, km traveled, countries visited, posts created, vendors booked\. Exportable PDF\.

__9\.3 Collaboration Access Control Matrix__

__Action__

__Admin__

__Co\-Admin__

__Member__

__Viewer__

View trip details & timeline

Ô£ô

Ô£ô

Ô£ô

Ô£ô

Post media to trip timeline

Ô£ô

Ô£ô

Ô£ô

Ô£ù

Add expenses

Ô£ô

Ô£ô

Ô£ô

Ô£ù

Add waypoint check\-in

Ô£ô

Ô£ô

Ô£ô

Ô£ù

Make bookings

Ô£ô

Ô£ô

Ô£ô

Ô£ù

Edit trip metadata \(title, dates, budget\)

Ô£ô

Ô£ô

Ô£ù

Ô£ù

Approve/reject join requests

Ô£ô

Ô£ô

Ô£ù

Ô£ù

Promote/demote collaborators

Ô£ô

Ô£ù

Ô£ù

Ô£ù

Change trip visibility

Ô£ô

Ô£ù

Ô£ù

Ô£ù

Transfer admin role

Ô£ô

Ô£ù

Ô£ù

Ô£ù

Delete/archive trip

Ô£ô

Ô£ù

Ô£ù

Ô£ù

Configure safety settings

Ô£ô

Ô£ô

Ô£ù

Ô£ù

__10\. Real\-Time Map & Location System ÔÇö Google Maps Grade__

__  Ôûî Google Maps processes 1 billion km of location data daily\. We build the same primitives at travel\-app scale\.  __

__10\.1 Location Architecture Layers__

__Layer__

__Technology__

__Responsibility__

__Data Flow__

Client Location

React Native Geolocation API

Get device GPS\. Battery\-aware: low\-accuracy mode when app is background\.

Device GPS ÔåÆ app ÔåÆ WebSocket OR explicit check\-in

WebSocket Transport

Socket\.io rooms

Broadcast location updates to trip room members in real\-time\.

Client ÔåÆ Socket\.io room:\{trip\_id\} ÔåÆ all connected members

Location Service \(Go\)

Go \+ MongoDB

Store check\-ins, compute geofences, serve waypoint APIs\. Go chosen for high\-throughput geo computation\.

WebSocket event ÔåÆ Go service ÔåÆ MongoDB \+ Redis geo

Geospatial DB

MongoDB 2dsphere index

Store waypoints, vendor locations, user home city as GeoJSON\. Run $nearSphere and $geoWithin queries\.

Vendor geofence polygon stored as GeoJSON Polygon

Geofence Engine

Redis Geospatial commands

GEOADD vendor locations\. GEODIST for radius check\. GEORADIUS for nearby lookup\. Sub\-millisecond\.

Location event ÔåÆ GEORADIUS ÔåÆ match vendor geofences

Map Rendering

MapLibre GL Native \(React Native\)

Renders vector tiles\. Custom travel\-mode route styles\. Offline tile support\.

m3u8 ÔåÆ tile server ÔåÆ device GPU render

Routing & Directions

Google Maps Directions API \(external\)

Compute actual road/rail route between waypoints\. Cache result\.

Waypoint pair ÔåÆ Maps API ÔåÆ polyline ÔåÆ stored in trip doc

Offline Tiles

S3 \+ MapLibre offline packs

Pre\-download tiles for active trip destination bounding box before departure\.

Trip created ÔåÆ Tile pack job ÔåÆ S3 ÔåÆ client download

__10\.2 Travel Mode Visual System__

__Travel Mode__

__Map Line Style__

__Icon Marker__

__Data Source__

__Notes__

Flight

Dashed arc \(great circle\)

Ô£ê Airplane

Manual or flight number API

Altitude arc visualization, not road route

Train

Dotted railway track pattern

­ƒÜé Train

Manual or IRCTC API \(Phase 2\)

Follows actual rail lines from routing API

Car / Cab

Solid line, road\-following

­ƒÜù Car

Google Maps Directions API

Real\-time traffic\-aware routing

Boat / Ferry

Wave\-pattern dashed line

ÔøÁ Boat

Manual waypoints

Straight line with wave overlay

Bus

Dashed line

­ƒÜî Bus

Manual or GTFS feed

Road\-following like car

Walk / Hike

Dotted footprint markers

­ƒÑ¥ Boot

OpenTopoData for elevation

Elevation profile shown alongside map

Bicycle

Dot\-dash pattern

­ƒÜ▓ Bike

Cycling\-specific routing API

Avoids highways

__10\.3 Geofencing ÔÇö Vendor Trigger System__

__Step__

__Action__

__Tech__

__Latency__

1

Trip location update received \(check\-in or live tracking ping\)

WebSocket ÔåÆ Location Service

< 100ms

2

GEORADIUS query: find all vendor geofences whose center is within 50km of user location

Redis GEORADIUS

< 5ms

3

For each vendor returned: check if user is within that vendor's specific geofence\_radius\_km

Redis GEODIST

< 2ms per vendor

4

Filter: already\-triggered today for this user\+vendor pair \(Redis set with 24h TTL\)

Redis SISMEMBER

< 1ms

5

For new triggers: fetch vendor catalog top 3 items\. Compose push payload\.

MongoDB \(cached\)

< 15ms

6

Push notification dispatched\. 'You're near \[Vendor\]\. Special rate: Ôé╣X\.'

FCM

< 500ms

7

Log trigger event to Kafka for analytics and vendor reporting

Kafka publish

< 5ms

__10\.4 Offline Map Strategy__

__Feature__

__Implementation__

__Detail__

Offline Tile Packs

MapLibre GL offline packs

On trip planning: compute bounding box of originÔåÆdestinationÔåÆwaypoints\. Download tile pack for zoom 8ÔÇô16\.

Waypoint Cache

SQLite \(device\)

All trip waypoints, metadata, and check\-in history stored locally\. Available offline\.

Check\-In Offline Queue

AsyncStorage \+ Bull local

Check\-ins while offline queued locally\. Sync on reconnect\. Server timestamps use client timestamp if offline\.

Vendor Cache

SQLite

Nearby vendors pre\-fetched when entering each waypoint city\. Cached for 48h\.

Sync Indicator

UI component

Clear offline badge \+ 'X items pending sync' counter\. Users know what's saved\.

Conflict Resolution

Last\-write\-wins \(most cases\)

For check\-ins: server timestamp is canonical\. For expense edits: most recent edit wins with notification to group\.

__11\. AI & Machine Learning Systems__

__11\.1 AI System Registry ÔÇö All ML Features__

__System__

__Model / Approach__

__Input__

__Output__

__Infrastructure__

Feed Ranking

XGBoost \(gradient boost\)

Engagement signals, relationship graph, recency, context

Post score 0\.0ÔÇô1\.0

TF Serving\. Re\-train weekly on ClickHouse data\.

Content Moderation

AWS Rekognition \(NSFW/Violence\) \+ fine\-tuned BERT \(text\)

Image bytes, video keyframes, caption text

Label \+ confidence score

Rekognition API \+ SageMaker endpoint

AI Trip Planner

LLM \(Claude API or GPT\-4o\)

Destination, dates, budget, group size, interests

Day\-by\-day itinerary JSON

Anthropic/OpenAI API\. Cached for popular destination\-budget combos\.

Memory Reel Generation

Video ML pipeline \+ ML clip scoring

All trip posts \(media \+ engagement\)

Ordered clip list \+ music suggestion

Lambda \+ FFmpeg \+ engagement scoring model

Packing List Generator

Rule\-based \+ LLM fallback

Destination, dates, season, activity tags

Categorized packing items list

LLM API for novel destinations, rule DB for common ones

Landmark Recognition

Google Vision API

Post image bytes \(user opt\-in\)

Place label \+ coordinates suggestion

Google Vision API call on photo upload

Vendor Recommendation

Collaborative filtering \(Matrix Factorization\)

User booking history, ratings, trip tags

Ranked vendor list for trip context

SageMaker batch job\. Results cached in Redis\.

Spam / Fake Account Detection

Gradient boost \+ behavioral features

Registration patterns, early action velocity, device fingerprint

Risk score 0ÔÇô1

Real\-time scoring at registration \+ daily batch rescore

Search Autocomplete

Elasticsearch Completion Suggester \+ popularity bias

Query prefix string

Ranked completions

Elasticsearch built\-in\. Popularity from query log analytics\.

Trip Memory Reel Music

Genre classification \+ mood mapping

Trip tags \(beach/adventure/culture\) \+ reel duration

Music track selection from licensed library

Rule\-based\. GenreÔåÆmoodÔåÆtrack selection\.

__11\.2 AI Trip Planner ÔÇö Full System Design__

The AI Planner lives inside the Trip Hub as a conversational interface\. It uses the LLM API with a carefully structured system prompt and real vendor catalog data\.

__Component__

__Design Decision__

__Reasoning__

LLM Choice

Claude API \(primary\) / GPT\-4o \(fallback\)

Claude excels at structured JSON output and following complex constraints\. Fallback for redundancy\.

System Prompt

Includes: destination weather, top attractions, vendor catalog excerpts, group preferences, budget constraints

Grounding the model in real data prevents hallucination of fake places or prices\.

Output Format

Strict JSON schema: \[\{ day, items:\[\{ time, activity, place\_id, estimated\_cost, duration\_min, booking\_possible, vendor\_id \}\] \}\]

Typed schema enables direct UI rendering and waypoint import without parsing\.

Caching

Cache by: destination \+ duration\_days \+ budget\_tier \+ interest\_tags \(hash key\)

Popular combinations \(Goa, 5 days, budget, beach\+party\) cached in Redis\. Saves ~80% LLM API calls\.

Group Voting

Each itinerary item has votes array: \{ up:\[\], down:\[\] \}

Members vote in the Hub\. Admin sees majority and can commit items as waypoints with one tap\.

Regeneration

User can say 'Make Day 2 more adventurous' or 'Replace the hotel with a hostel'

New LLM call with chat history context\. Streaming response shown character\-by\-character\.

Cost Injection

Vendor Service queried for real pricing before response returned to user

If vendor\_id matched: real price\. If not: LLM estimate labeled '~approximate'\.

Fallback

If LLM API unavailable: serve cached popular itinerary for destination

Users see a slightly generic result rather than an error\.

__11\.3 Memory Reel Generation Pipeline__

__Step__

__Action__

__Detail__

1

Trip completes\. Reel generation job queued in Bull\.

Job includes: trip\_id, all collaborator user\_ids, all post\_ids tagged to trip\.

2

Fetch all trip posts ordered by created\_at\. Filter: video posts prioritized\. Min 3s, max 90s each\.

Post Service query: \{ trip\_id, type: \{ $in:\['post','reel'\] \} \} sorted by created\_at\.

3

Score each clip: engagement\_score ├ù completion\_rate ├ù collaborator\_reaction\_count\.

Top\-scored clips selected\. At least 1 clip per collaborator if possible \(fairness rule\)\.

4

Determine music: map trip tags to mood\. Select licensed track from music library by duration match\.

beach\+party ÔåÆ upbeat pop\. adventure ÔåÆ epic\. culture ÔåÆ acoustic\. Duration: ceil\(total\_clips\_duration\)\.

5

Generate reel via FFmpeg: concat clips, add music at 40% volume, add location title cards at each waypoint transition\.

FFmpeg command on Fargate Spot instance\. Outputs: 1080x1920 MP4 H\.264\.

6

Upload to S3\. CloudFront URL stored as trip\.memory\_reel\_url\. Status: 'ready'\.

Notification sent to all collaborators: 'Your Goa Memory Reel is ready\!'

7

Each collaborator can: preview, edit trim points \(basic\), download, or share as 'Trip Memory' post type\.

'Trip Memory' post type has special UI treatment in feed ÔÇö shows group avatar cluster\.

__12\. Hyper\-Local Marketplace & Geo\-Commerce__

__12\.1 Vendor Onboarding Funnel__

__Step__

__Action__

__Completion Gate__

__Automated Action__

1

Vendor registers via B2B web portal\. Basic info: business name, category, city, phone\.

Email OTP verified

Welcome email with onboarding checklist\.

2

Upload KYC documents: Aadhaar, PAN, GST certificate, bank account details\.

Documents uploaded

DigiLocker API verification initiated for Aadhaar/PAN\.

3

KYC review: automated checks \+ human review for edge cases\.

KYC approved \(24ÔÇô48h SLA\)

Vendor tier set to 'basic'\. Catalog builder unlocked\.

4

Build catalog: add services, pricing, photos, availability calendar\.

ÔëÑ 1 catalog item active

Vendor appears in search index \(Elasticsearch sync\)\.

5

Set geofence: draw service area on map or set radius\.

Geofence saved

Vendor added to Redis geo index for trigger matching\.

6

Choose subscription tier\. Free tier: listing only\. Paid: geo\-triggers \+ analytics\.

Subscription selected

Geo\-trigger radius activated for paid tiers\.

7

First booking received\. Trial period complete\.

First booking confirmed

Vendor dashboard shows earnings, booking history, review count\.

__12\.2 Subscription Tier Comparison__

__Feature__

__Free__

__Basic \(Ôé╣999/mo\)__

__Growth \(Ôé╣2,499/mo\)__

__Premium \(Ôé╣4,999/mo\)__

Catalog listings

3 items

10 items

Unlimited

Unlimited

Search visibility

Basic

Standard

Boosted

Featured placement

Geo\-triggered push

Ô£ù

Ô£ô \(5km radius\)

Ô£ô \(25km radius\)

Ô£ô \(50km radius\)

Analytics dashboard

Ô£ù

Basic \(7d\)

Full \(90d\)

Advanced \+ export

Promoted in Explore

Ô£ù

Ô£ù

Ô£ô

Ô£ô \(priority\)

Booking commission

8%

7%

6%

5%

Response SLA badge

Ô£ù

Ô£ù

Ô£ô

Ô£ô

Multi\-location

1

2

5

Unlimited

API access

Ô£ù

Ô£ù

Ô£ù

Ô£ô \(webhook \+ API\)

__12\.3 Booking Flow ÔÇö End to End__

__Step__

__Actor__

__Action__

__Backend__

1

User

Sees geo\-triggered push or browses vendor in Trip Hub marketplace panel\.

Vendor Service returns catalog with real\-time availability check\.

2

User

Selects catalog item\. Chooses dates, guest count\. Views price breakdown\.

Booking Service creates tentative hold: availability\_calendar item status ÔåÆ 'held' \(15 min TTL\)\.

3

User

Reviews: subtotal \+ platform fee \+ GST \+ total\. Confirms booking\.

Payment Service creates Razorpay order\. Returns payment\_link\.

4

User

Completes payment via UPI / card / netbanking in Razorpay sheet\.

Razorpay captures payment\. Sends webhook to Payment Service\.

5

System

Payment webhook received\. Payment record updated: status ÔåÆ 'captured'\.

Booking Service: status ÔåÆ 'confirmed'\. Availability: 'held' ÔåÆ 'booked'\. QR generated\.

6

System

Confirmation dispatched\.

Push \+ email to user \(with QR\)\. Push to vendor \(booking alert\)\. Trip Hub updated\.

7

Vendor

Sees booking in vendor dashboard\. Scans QR at service delivery\.

Booking Service: status ÔåÆ 'active'\. Records check\-in time\.

8

System

Service delivery complete\. T\+1 day settlement initiated\.

Payment Service: vendor\_payout transferred\. Settlement record created\.

9

System

24h after checkout: review prompt sent to user\.

Review only unlocked if booking\.status = 'completed'\. One review per booking\.

__13\. Payment & Financial Infrastructure__

__13\.1 Payment Architecture Principles__

__Principle__

__Implementation__

__Why__

Never store card data

100% delegated to Razorpay/Stripe\. PCI DSS is their problem\.

PCI compliance is expensive and risky\. Delegation is standard practice\.

Idempotent payments

Every payment request has idempotency\_key = booking\_id \+ timestamp\_bucket

Prevents double\-charge if user taps 'Pay' twice or network retries fire\.

Atomic state transitions

PostgreSQL transactions for payment\+settlement\. MongoDB sessions for booking status\.

Money and booking state must move together\. Partial updates are financial bugs\.

Webhook verification

HMAC\-SHA256 signature on all Razorpay webhooks verified before processing\.

Prevents fake webhook attacks from triggering fraudulent confirmations\.

Ledger immutability

Payment records are append\-only\. Corrections via new records, not updates\.

Financial audit trail must be complete\. UPDATE on payment rows is forbidden\.

Settlement escrow

Funds held for 24h post\-service before vendor payout\.

Protects users in case of no\-show\. Vendor can dispute within 24h window\.

__13\.2 Commission Engine__

__Booking Amount__

__Platform Fee %__

__Vendor Payout %__

__GST on Fee__

__Effective User Cost__

Ôé╣0 ÔÇô Ôé╣1,000

8%

92%

1\.44% of total

Price \+ 8% fee \+ 1\.44% GST on fee

Ôé╣1,001 ÔÇô Ôé╣5,000

7%

93%

1\.26%

Growth tier vendor: 6%

Ôé╣5,001 ÔÇô Ôé╣20,000

6%

94%

1\.08%

Premium tier vendor: 5%

> Ôé╣20,000

5%

95%

0\.90%

All large bookings at min rate

Group Booking Bonus

ÔêÆ0\.5% extra discount

ÔÇö

ÔÇö

Incentivizes group bookings

__13\.3 Expense Splitting Engine__

__Split Method__

__Algorithm__

__Example__

__Edge Cases Handled__

Equal Split

amount ├À participant\_count, penny goes to first payer

Ôé╣2,400 ├À 4 = Ôé╣600 each

Odd amounts: Ôé╣2,401 ÔåÆ 3├ùÔé╣600 \+ 1├ùÔé╣601

Percentage Split

Each member assigned % manually

60% Rahul, 40% Priya on Ôé╣1,000

Must sum to 100%\. Validation on submit\.

Fixed Amount Split

Named amounts per person, remainder to payer

Priya: Ôé╣500, rest on Rahul

Remainder displayed before confirm\.

Item Split

Each item assigned to specific people \(restaurant bill\)

Pizza: Rahul\+Priya\. Beer: everyone\.

UI: itemized bill entry\. Each item tagged to members\.

Settlement Algorithm

Minimize transaction count \(min\-cost flow algo\)

5 people, 8 expenses ÔåÆ 4 settlements

Graph reduction: never more transactions than \(n\-1\) settlements needed\.

__13\.4 UPI In\-App Settlement Flow__

__Step__

__Action__

__Tech__

1

Expense settlement summary computed\. Alice owes Bob Ôé╣1,200\.

Expense Service min\-flow algorithm

2

Alice taps 'Pay Bob Ôé╣1,200'\. UPI payment sheet opens\.

Razorpay UPI SDK \(in\-app, no browser redirect\)

3

Alice authenticates via UPI PIN on her bank app\.

UPI 2\.0 / BHIM rails

4

Payment confirmed\. Expense Service marks settlement status ÔåÆ 'settled'\. Balance updated\.

Razorpay webhook ÔåÆ Expense Service

5

Both Alice and Bob receive confirmation push\. Group chat system message: 'Alice settled Ôé╣1,200 with Bob'

Notification Service

6

Trip Summary PDF updated\. Expense board shows Ôé╣0 balance\.

Expense Service ÔåÆ PDF generator

__14\. Real\-Time Architecture ÔÇö WebSocket Design__

__14\.1 Socket\.io Room Structure__

__Room Name__

__Members__

__Events Published__

__Events Subscribed__

user:\{user\_id\}

Single user \(all devices\)

notification, dm\_message, feed\_update

Personal notifications, DMs

trip:\{trip\_id\}

All active trip collaborators

location\_update, new\_post, chat\_message, expense\_added, state\_changed

Trip\-wide real\-time events

chat:\{conversation\_id\}

Conversation participants

message, read\_receipt, typing\_indicator, user\_online

Chat\-specific events

trip:map:\{trip\_id\}

Members with location sharing on

member\_location, waypoint\_checkin

Live map updates

vendor:\{vendor\_id\}

Vendor dashboard users

new\_booking, booking\_cancelled, new\_review

Vendor real\-time alerts

__14\.2 Horizontal Scaling ÔÇö Redis Pub/Sub__

Socket\.io connections are stateful ÔÇö a user's socket is pinned to one server pod\. For multi\-pod clusters, we use Redis as a shared pub/sub layer\. Any pod can publish; the pod holding the user's socket will deliver it\.

__Scenario__

__Without Redis Adapter__

__With Redis Adapter__

User A on Pod 1, User B on Pod 2, A sends B a message

Pod 1 cannot find B's socket\. Message lost\.

Pod 1 publishes to Redis\. Pod 2 subscribes and delivers to B's socket\.

New post fan\-out to 1000 followers across 5 pods

Only followers on Pod 1 get live update\.

Event published once to Redis\. All 5 pods deliver to their connected followers\.

Scale from 3 to 10 pods

New pods are disconnected islands\.

New pods join Redis cluster\. Instantly participate in all room events\.

__14\.3 Typing Indicators & Presence__

__Feature__

__Implementation__

__Performance Detail__

Typing Indicator

Client sends typing\_start on first keystroke\. Server broadcasts to room\. Client sends typing\_stop after 2s idle\.

Debounced: max 1 event/2s per user\. TTL in Redis: 5s \(auto\-clears if client disconnects\)\.

Online Presence

SETEX user:online:\{user\_id\} 30 Redis key on every socket heartbeat \(q/15s\)\.

TTL\-based: if no heartbeat for 30s, user is offline\. No explicit disconnect event needed\.

Last Seen

On socket disconnect: UPDATE user set last\_active\_at = NOW\(\)\.

Shown as 'last seen 2 minutes ago'\. Respect privacy setting: can disable\.

Read Receipts

Client sends read\_event for each message\_id\. Batched: send after 100ms debounce\.

Bulk update: \{ message\_ids:\[\], read\_at:Date \}\. Single DB write per batch\.

Delivery Receipts

On message insert, mark delivered\_to for all connected members in room\.

O\(n\) where n = online members in room\. Offline members get delivery on next connect\.

__15\. Security, Auth & Privacy Framework__

__15\.1 Authentication Architecture__

__Flow__

__Mechanism__

__Token Lifetime__

__Storage__

Email/Password Login

bcrypt hash \(cost=12\)\. Password strength enforced client \+ server\.

Access: 15min\. Refresh: 30d\.

Access: memory\. Refresh: HttpOnly cookie \(web\) / SecureStorage \(mobile\)\.

Phone OTP Login

6\-digit OTP via Twilio\. Rate limit: 3 OTPs/phone/hour\. Brute force: 5 attempts then 15min lockout\.

Same as above\.

Same as above\.

Google OAuth

OAuth 2\.0\. ID token verified via Google JWKS\. Account linked on first login\.

Same as above\.

Google refresh token stored encrypted in MongoDB\.

Apple Sign\-In

Sign in with Apple\. Identity token verified\. Private email relay handled\.

Same as above\.

Apple refresh token encrypted in MongoDB\.

JWT Structure

Header: RS256\. Payload: \{ user\_id, roles, device\_id, iat, exp \}\. Signed with RSA private key\.

ÔÇö

Public key in JWKS endpoint for gateway validation\.

Refresh Token Rotation

On refresh: old token invalidated, new token issued\. Refresh token family tracked\.

ÔÇö

Stolen refresh token: family invalidated on reuse detection\.

Token Revocation

Redis set: revoked\_tokens:\{user\_id\}\. Checked on every request\.

TTL = access token lifetime

Logout, password change, suspicious activity: all tokens revoked\.

__15\.2 Location Privacy Controls__

__Mode__

__Trigger__

__Data Stored__

__Shared With__

__User Control__

OFF \(default\)

Account creation default

Nothing

No one

On/off toggle in Privacy settings

Check\-In Only

User taps check\-in button

GeoJSON Point at moment of tap

Trip collaborators only

Per check\-in consent

Live Tracking

User explicitly enables for this trip

Location q/30s for up to 12h

Trip collaborators only

Pause/stop button always visible

Photo Metadata

User opts in at post creation

GeoJSON Point extracted from EXIF

Trip log \+ post location

Toggle per post, default OFF

Geofence Triggers

Always \(server\-side only\)

NEVER stored as raw coordinate

No one

Can disable vendor push in settings

Trusted Contact Link

SOS mode activated

Live location stream

Named non\-app contacts

Link expires after 24h or trip end

__15\.3 Data Security Controls__

__Control__

__Implementation__

__Scope__

Data in Transit

TLS 1\.3 minimum\. TLS 1\.0/1\.1 disabled\. Certificate pinning in mobile apps\.

All API, WebSocket, and CDN traffic

Data at Rest

AES\-256\. MongoDB Atlas encryption at rest\. S3 SSE\-S3\. RDS encryption enabled\.

All databases and file storage

Field\-Level Encryption

MongoDB CSFLE for: email, phone, bank\_account\_number, kyc\_document\_refs\.

Encrypted before write, decrypted on authorized read only

PII Minimization

Phone and email hashed \(SHA\-256\) for analytics\. Raw PII never in ClickHouse\.

Analytics pipeline ÔÇö DPDP compliance

KYC Document Isolation

Stored in separate S3 bucket with IAM policy: only KYC service IAM role has read access\.

Aadhaar, PAN, passport scans

Payment Data

No card data ever stored\. Razorpay/Stripe are PCI DSS Level 1\. We store only payment\_id references\.

All financial data

SQL Injection

Parameterized queries only in PostgreSQL\. Mongoose ODM for MongoDB\.

All database queries

XSS Prevention

Content\-Security\-Policy header\. All user content sanitized via DOMPurify before render\.

All web\-rendered user content

CSRF Protection

SameSite=Strict cookie\. CSRF token on all state\-changing web requests\.

Web dashboard only

Audit Logging

All admin actions, KYC decisions, payment operations written to immutable audit log in S3\.

Compliance \+ forensics

Pen Testing

External penetration test every 6 months\. Bug bounty program via HackerOne\.

Full platform scope

__16\. Observability, Monitoring & On\-Call__

__16\.1 The Three Pillars of Observability__

__Pillar__

__Tool__

__What We Track__

__Alert Threshold__

Metrics

Prometheus \+ Grafana

Request rate, error rate \(4xx/5xx\), P50/P95/P99 latency, DB query time, queue depth, cache hit rate

P99 > 500ms for 2min ÔåÆ PagerDuty\. Error rate > 1% ÔåÆ Slack alert\. Error rate > 5% ÔåÆ PagerDuty wake\.

Logs

AWS CloudWatch \+ Loki

Structured JSON logs \(all services\)\. Log level: ERROR always, DEBUG in staging\. Request ID in every log line\.

ERROR spike > 10/min on any service ÔåÆ Slack alert\.

Traces

Jaeger \+ AWS X\-Ray

Distributed traces across all service hops\. Slow queries auto\-annotated\.

Trace P99 > 1s on any critical path ÔåÆ investigation ticket\.

__16\.2 SLO Definitions ÔÇö Service Level Objectives__

__Service__

__SLO Metric__

__Target__

__SLO Window__

__Burn Rate Alert__

Feed API

Availability \(success rate\)

99\.5%

30\-day rolling

> 5% budget burned in 1h ÔåÆ page on\-call

Feed API

P99 latency

< 300ms

30\-day rolling

P99 > 500ms for 5min ÔåÆ Slack

Messaging

Delivery rate \(DMs delivered\)

99\.9%

30\-day rolling

< 99\.5% for 5min ÔåÆ page on\-call

Messaging

P99 latency \(sendÔåÆreceive\)

< 200ms

30\-day rolling

P99 > 500ms for 2min ÔåÆ Slack

Booking API

Availability

99\.9%

30\-day rolling

Any breach ÔåÆ immediate page

Payment Webhook

Processing success rate

99\.99%

30\-day rolling

Any failure ÔåÆ immediate page \+ financial escalation

Media Upload

P95 upload\-to\-live time

< 30 seconds

30\-day rolling

P95 > 60s for 10min ÔåÆ Slack

Map/Location

Geofence trigger latency

< 10 seconds

30\-day rolling

> 30s for 5min ÔåÆ Slack

__16\.3 On\-Call Runbook ÔÇö Incident Response__

__Severity__

__Criteria__

__Response Time__

__Actions__

SEV\-1

Full service down\. >50% users cannot use core feature\.

5 minutes

Wake on\-call\. War room in Slack\. Status page updated\. CEO notified\. All hands if > 30 min\.

SEV\-2

Partial degradation\. >20% of requests failing or P99 > 2s\.

15 minutes

On\-call investigates\. Slack alert in \#incidents\. Status page if user\-visible\.

SEV\-3

Minor degradation\. <20% affected\. Error rate elevated but not critical\.

1 hour

Investigation next business hour\. Ticket filed\.

SEV\-4

Single user report\. No measurable platform impact\.

Next business day

Support ticket\. Engineering ticket if reproducible\.

__17\. Mobile App Architecture ÔÇö React Native__

__17\.1 App Architecture Pattern ÔÇö Feature\-Sliced Design__

We use Feature\-Sliced Design \(FSD\) ÔÇö a scalable frontend architecture used by large teams\. Each feature is self\-contained: its own components, hooks, API calls, and state\.

__Layer__

__Folder__

__Contents__

__Rule__

App

app/

Navigation config, app providers, global middleware, store init

Only imports from features and shared

Features

features/

feed/, trip/, messaging/, map/, marketplace/, auth/, profile/, stories/, reels/

Each feature fully self\-contained\. No cross\-feature imports\.

Entities

entities/

user/, post/, trip/, vendor/, booking/

Domain objects: types, API calls, selectors\. Shared across features\.

Shared

shared/

UI components, hooks, utils, constants, API client, types

No business logic\. Pure utilities\.

Infrastructure

infrastructure/

socket\.js, storage\.js, location\.js, push\.js, analytics\.js

Platform APIs\. Single source of truth for each native capability\.

__17\.2 State Management Architecture__

__State Category__

__Store__

__Persistence__

__Why__

Auth \(tokens, user\_id\)

Zustand \+ SecureStorage

Yes \(device\)

Needs to survive app restart\. Secure storage for tokens\.

Active Trip

Zustand

Yes \(AsyncStorage\)

Survive app restart\. Critical offline use case\.

Feed Posts

React Query cache

No \(memory\)

Auto\-invalidated, re\-fetched\. No stale data risk\.

Chat Messages

Zustand \+ SQLite

Yes \(SQLite\)

Offline chat history\. Indexed by conversation\_id\.

User Profile \(own\)

Zustand

Partial \(AsyncStorage\)

Quick display while refresh happens in background\.

Map / Location

Zustand

No

Real\-time\. Stale location data is worse than no data\.

Vendor Catalog

React Query cache

TTL: 30min

Frequently browsed\. Cache reduces API calls on spotty mobile\.

Offline Queue

AsyncStorage \+ custom sync

Yes

Pending writes \(check\-ins, posts, expenses\) that failed due to no network\.

__17\.3 Navigation Structure__

__Navigator__

__Type__

__Screens__

Root Navigator

Stack

Splash, Onboarding, Auth Stack, Main Tab \(after login\)

Auth Stack

Stack

Login, Register, OTP Verify, Forgot Password, OAuth Callback

Main Tab

Bottom Tabs

Feed, Discover, Journey \(center, highlighted\), Notifications, Profile

Feed Stack

Stack

FeedHome, PostDetail, CommentSheet, HashtagFeed, LocationFeed

Journey Stack

Stack

JourneyHome, TripCreate, TripHub, TripMap, WaypointDetail, AiPlanner, PackingList, ExpenseTracker, VendorPanel, SafetyPanel, MemoryReel

Discover Stack

Stack

DiscoverHome, Search, TrendingHashtag, NearbyPosts, PublicTrips

Profile Stack

Stack

ProfileHome, EditProfile, Followers, Following, Settings, PrivacySettings, NotificationSettings, Blocked

Messaging Stack

Stack

InboxList, ConversationView, NewConversation, MediaViewer

Marketplace Stack

Stack \(modal\)

VendorProfile, CatalogItem, BookingFlow, BookingConfirmed, ReviewWrite

__17\.4 Performance Targets & Techniques__

__Metric__

__Target__

__Technique__

App launch \(cold start\)

< 2 seconds

Hermes JS engine\. Lazy feature import\. Show skeleton screens immediately\.

Feed scroll FPS

60 FPS consistent

FlashList \(not FlatList\)\. Recycled list items\. Image caching \(react\-native\-fast\-image\)\.

Image load time

BlurHash visible < 50ms

BlurHash decoded in < 5ms\. Progressive image loading\.

Video autoplay lag

< 300ms

Pre\-buffer next 3 reel URLs\. HLS manifest pre\-fetched\.

Map render

< 100ms tile render

MapLibre vector tiles\. GPU\-accelerated\. Pre\-loaded offline pack\.

Navigation transition

< 100ms

Native stack navigator \(not JS bridge\)\. Native swipe gestures\.

Memory usage

< 200MB active

FlatList/FlashList recycling\. Offscreen image cache eviction\. Video unload when scrolled away\.

Bundle size

< 10MB JS bundle

Code splitting per feature\. Metro bundle analyzer\. Tree shaking\.

__18\. Complete API Reference__

__18\.1 Auth Service APIs__

__Method__

__Endpoint__

__Auth__

__Body / Params__

__Response__

POST

/v1/auth/register

ÔÇö

\{ phone, password, display\_name \}

\{ user\_id, access\_token, refresh\_token \}

POST

/v1/auth/login/phone

ÔÇö

\{ phone, password \}

\{ access\_token, refresh\_token \}

POST

/v1/auth/otp/send

ÔÇö

\{ phone \}

\{ message: 'OTP sent' \}

POST

/v1/auth/otp/verify

ÔÇö

\{ phone, otp \}

\{ access\_token, refresh\_token \}

POST

/v1/auth/oauth/google

ÔÇö

\{ id\_token \}

\{ access\_token, refresh\_token, is\_new\_user \}

POST

/v1/auth/refresh

Refresh token

ÔÇö

\{ access\_token \}

POST

/v1/auth/logout

Bearer JWT

ÔÇö

\{ message: 'Logged out' \}

__18\.2 User Service APIs__

__Method__

__Endpoint__

__Auth__

__Body / Params__

__Response__

GET

/v1/users/:username

Optional

ÔÇö

User profile object

PATCH

/v1/users/me

Bearer JWT

\{ display\_name, bio, website, preferences \}

Updated user object

POST

/v1/users/:id/follow

Bearer JWT

ÔÇö

\{ following: true \}

DELETE

/v1/users/:id/follow

Bearer JWT

ÔÇö

\{ following: false \}

GET

/v1/users/:id/followers

Optional

?cursor&limit=20

\{ users:\[\], next\_cursor \}

GET

/v1/users/:id/following

Optional

?cursor&limit=20

\{ users:\[\], next\_cursor \}

POST

/v1/users/:id/block

Bearer JWT

ÔÇö

\{ blocked: true \}

POST

/v1/users/me/avatar

Bearer JWT

multipart/form\-data

\{ avatar\_url \}

__18\.3 Feed & Post APIs__

__Method__

__Endpoint__

__Auth__

__Params__

__Response__

GET

/v1/feed

Bearer JWT

?cursor&limit=20

\{ posts:\[\], next\_cursor \}

GET

/v1/feed/explore

Optional

?cursor&limit=20

\{ posts:\[\], next\_cursor \}

POST

/v1/posts

Bearer JWT

\{ media\_urls\[\], caption, location, trip\_id? \}

Created post object

GET

/v1/posts/:id

Optional

ÔÇö

Full post object with engagement counts

DELETE

/v1/posts/:id

Bearer JWT \(author\)

ÔÇö

\{ deleted: true \}

POST

/v1/posts/:id/like

Bearer JWT

ÔÇö

\{ liked: true, like\_count \}

DELETE

/v1/posts/:id/like

Bearer JWT

ÔÇö

\{ liked: false, like\_count \}

POST

/v1/posts/:id/save

Bearer JWT

ÔÇö

\{ saved: true \}

GET

/v1/posts/:id/comments

Optional

?cursor&limit=20

\{ comments:\[\], next\_cursor \}

POST

/v1/posts/:id/comments

Bearer JWT

\{ text, reply\_to\_id? \}

Created comment object

GET

/v1/posts/hashtag/:tag

Optional

?cursor

\{ posts:\[\], next\_cursor \}

POST

/v1/posts/:id/report

Bearer JWT

\{ reason \}

\{ reported: true \}

__18\.4 Trip Service APIs__

__Method__

__Endpoint__

__Auth__

__Body / Params__

__Response__

POST

/v1/trips

Bearer JWT

\{ title, origin, destination, dates, budget, visibility, tags \}

Created trip object

GET

/v1/trips/:id

Collaborator JWT

ÔÇö

Full trip object with collaborators, waypoints

PATCH

/v1/trips/:id

Admin JWT

\{ title, dates, budget, visibility \}

Updated trip

POST

/v1/trips/:id/publish

Admin JWT

ÔÇö

\{ status: 'planning' \}

POST

/v1/trips/:id/activate

Admin JWT

ÔÇö

\{ status: 'active' \}

POST

/v1/trips/:id/complete

Admin JWT

ÔÇö

\{ status: 'completed' \}

POST

/v1/trips/:id/invite

Admin JWT

\{ user\_ids\[\], role \}

\{ invites\_sent: n \}

POST

/v1/trips/:id/join

Bearer JWT

\{ message? \}

\{ status: 'pending' \}

PATCH

/v1/trips/:id/requests/:uid

Admin JWT

\{ action: 'approve|reject', role? \}

Updated collaborator

GET

/v1/trips/:id/timeline

Collaborator JWT

?cursor&limit=20

\{ posts:\[\], next\_cursor \}

POST

/v1/trips/:id/waypoints

Collaborator JWT

\{ location, label, travel\_mode, notes \}

Created waypoint

PATCH

/v1/trips/:id/waypoints/:idx/checkin

Collaborator JWT

\{ actual\_arrival? \}

Updated waypoint

GET

/v1/trips/me

Bearer JWT

?status=active|planning

\{ trips:\[\] \}

GET

/v1/trips/public

Optional

?destination&cursor

\{ trips:\[\], next\_cursor \}

__18\.5 Messaging APIs__

__Method__

__Endpoint__

__Auth__

__Body / Params__

__Response__

GET

/v1/conversations

Bearer JWT

?cursor&limit=20

\{ conversations:\[\], next\_cursor \}

POST

/v1/conversations

Bearer JWT

\{ participant\_ids\[\], type:'direct|group', name? \}

Created conversation

GET

/v1/conversations/:id/messages

Bearer JWT

?cursor&limit=40

\{ messages:\[\], next\_cursor \}

POST

/v1/conversations/:id/messages

Bearer JWT

\{ type, content?, media\_url?, reply\_to\_id? \}

Created message

POST

/v1/conversations/:id/read

Bearer JWT

\{ message\_ids\[\] \}

\{ read: true \}

DELETE

/v1/messages/:id

Bearer JWT \(sender\)

ÔÇö

\{ deleted\_for\_all: bool \}

__18\.6 Vendor & Booking APIs__

__Method__

__Endpoint__

__Auth__

__Body / Params__

__Response__

GET

/v1/vendors/nearby

Bearer JWT

?lat&lng&radius\_km&category

\{ vendors:\[\], total \}

GET

/v1/vendors/:id

Optional

ÔÇö

Full vendor profile with catalog

GET

/v1/vendors/:id/reviews

Optional

?cursor

\{ reviews:\[\], next\_cursor \}

GET

/v1/vendors/:id/availability

Bearer JWT

?item\_id&start\_date&end\_date

\{ available\_dates:\[\] \}

POST

/v1/bookings

Bearer JWT

\{ vendor\_id, catalog\_item\_id, dates, guests\[\] \}

\{ booking\_id, payment\_order \}

POST

/v1/bookings/:id/confirm

Razorpay webhook

\{ payment\_id, signature \}

\{ status: 'confirmed', qr\_url \}

GET

/v1/bookings/me

Bearer JWT

?status

\{ bookings:\[\] \}

POST

/v1/bookings/:id/cancel

Bearer JWT

\{ reason \}

\{ status: 'cancelled', refund\_amount \}

POST

/v1/vendors/:id/reviews

Verified Booking JWT

\{ rating, text, media\_urls\[\] \}

Created review

__18\.7 Expense & Map APIs__

__Method__

__Endpoint__

__Auth__

__Body / Params__

__Response__

POST

/v1/trips/:id/expenses

Collaborator JWT

\{ description, amount, paid\_by, split\_method, splits\[\] \}

Created expense

GET

/v1/trips/:id/expenses

Collaborator JWT

?cursor

\{ expenses:\[\], summary:\{ balances:\{\} \} \}

POST

/v1/trips/:id/expenses/settle

Collaborator JWT

\{ settlement\_id \}

\{ payment\_order \}

GET

/v1/trips/:id/expenses/summary

Collaborator JWT

ÔÇö

\{ per\_person\_totals, settlements\_needed:\[\] \}

POST

/v1/location/checkin

Bearer JWT

\{ trip\_id, location:GeoJSON, waypoint\_index? \}

\{ checkin\_id, triggered\_vendors:\[\] \}

POST

/v1/location/live/start

Bearer JWT

\{ trip\_id \}

\{ room\_id \}

POST

/v1/location/live/stop

Bearer JWT

\{ trip\_id \}

\{ message: 'stopped' \}

GET

/v1/trips/:id/map

Collaborator JWT

ÔÇö

\{ waypoints\[\], member\_locations\[\], route\_polyline \}

__19\. Development Roadmap & Hiring Plan__

__19\.1 5\-Phase Roadmap__

__Phase__

__Timeline__

__Goal__

__Deliverables__

__Team__

0: Foundation

M 1ÔÇô2

Infrastructure \+ skeleton

AWS setup, CI/CD, Auth Service, User Service, API Gateway, MongoDB Atlas, Redis, basic React Native shell

2 BE, 1 DevOps, 1 Mobile

1: Social

M 3ÔÇô6

Working social product

Feed, Posts, Stories, Reels, DM, Search, Notifications, Media Pipeline, Content Moderation

4 BE, 1 ML, 3 Mobile, 1 Designer

2: Journey

M 7ÔÇô11

Core IP live

Trip Engine, Map System, Collaborative Hub, AI Planner, Packing List, Expense Tracker, Offline Mode, Memory Reel

5 BE, 2 ML, 3 Mobile, 1 Designer

3: Marketplace

M 12ÔÇô16

Revenue generating

Vendor Portal, KYC, Geo\-Commerce, Booking Engine, Payment Integration, Reviews, Group Booking

5 BE, 2 Mobile, 2 Biz Dev \(vendor onboarding\)

4: Scale & Growth

M 17ÔÇô24

MNC\-grade scale

Gamification, Safety Mode, International, ML personalization, B2B API, Enterprise analytics, Series A metrics

Full team \+ Growth \+ Data Science

__19\.2 Engineering Hiring Plan__

__Role__

__Phase__

__Count__

__Key Skills__

__Salary Range \(INR\)__

Senior Backend Engineer \(Node\.js\)

0ÔÇô1

3

Node\.js, MongoDB, Redis, Kafka, REST API design, microservices

Ôé╣30ÔÇô50L/yr

Senior Backend Engineer \(Go\)

1ÔÇô2

2

Go, high\-performance services, geospatial, gRPC

Ôé╣35ÔÇô55L/yr

Senior Mobile Engineer \(React Native\)

0ÔÇô1

2

React Native, Redux/Zustand, native modules, performance

Ôé╣28ÔÇô45L/yr

DevOps / Platform Engineer

0

1

AWS, Kubernetes, Terraform, CI/CD, Kafka, monitoring

Ôé╣35ÔÇô55L/yr

ML Engineer

1

1

Python, recommendation systems, XGBoost, TF, Kafka consumer

Ôé╣35ÔÇô60L/yr

Product Designer \(UI/UX\)

0

1

Figma, mobile\-first, design systems, user research

Ôé╣20ÔÇô35L/yr

Backend Engineer \(Payments\)

2

1

Payment gateways \(Razorpay/Stripe\), UPI, financial systems, PostgreSQL

Ôé╣30ÔÇô50L/yr

Data Engineer

2

1

ClickHouse, Kafka, ETL, Python, analytics pipelines

Ôé╣28ÔÇô45L/yr

Security Engineer

2

1

VAPT, DPDP compliance, auth systems, encryption

Ôé╣30ÔÇô50L/yr

QA Engineer

1

1

Appium, Jest, Postman, load testing, test automation

Ôé╣15ÔÇô25L/yr

__19\.3 MVP Launch Criteria ÔÇö Go/No\-Go Checklist__

__\#__

__Criteria__

__Measurable Gate__

__Owner__

1

Core social loop functional

User can post, follow, like, comment, DM\. Zero P0 bugs\.

Mobile \+ Backend

2

Trip creation to active flow

5\-person test trip completes all state transitions without error\.

Trip Service team

3

Map renders offline

All waypoints visible in airplane mode in test destination\.

Map Service team

4

At least 50 onboarded vendors in pilot city

50 vendors with KYC verified \+ ÔëÑ1 active catalog item\.

Business Dev

5

One end\-to\-end booking test

Test user books, pays, receives QR, vendor scans\. Settlement T\+1\.

Booking \+ Payment team

6

Content moderation live

NSFW detection running on all uploads\. Moderation queue staffed\.

ML \+ Ops

7

Load test passed

500 concurrent users\. Feed P99 < 300ms\. No crashes\.

DevOps \+ Backend

8

App Store \+ Play Store approved

Both apps in review\-passed state, staged rollout ready\.

Mobile team

9

Security audit passed

External pen test\. No critical/high findings unresolved\.

Security

10

On\-call rotation set up

PagerDuty configured\. Runbooks written\. At least 3 engineers on rotation\.

DevOps \+ All leads

__20\. New Features ÔÇö Beyond the Original Plan__

These are features that set Trip Party apart from existing products\. Each has a full technical design, not just an idea\.

__20\.1 Trip Score & Traveler Rank System \(Gamification\)__

__  Ôûî Retention driver\. Users with ranks churn 60% less\. Reference: Duolingo streaks, Swiggy Super\.  __

__Action__

__XP Awarded__

__Badge Trigger__

__Implementation__

Complete first trip

500 XP

First Journey ­ƒù║´©Å

Trip status ÔåÆ completed event ÔåÆ XP worker

Book via platform

200 XP / booking

Local Hero ­ƒÅà

booking\.confirmed event ÔåÆ XP worker

Visit 5 new states/countries

1000 XP

Wanderer ­ƒîÅ

Waypoint check\-in ÔåÆ location resolver ÔåÆ unique state count

Lead 3 group trips \(as admin\)

750 XP

Trip Captain ÔÜô

trip\.completed \+ admin\_id match ÔåÆ XP worker

10 verified reviews written

300 XP

Trusted Voice ­ƒôØ

review\.created \(verified booking\) ÔåÆ XP worker ÔåÆ counter

7\-day check\-in streak

350 XP

On the Road ­ƒøú´©Å

Daily check\-in event ÔåÆ Redis streak counter \(resets at midnight IST\)

1000 km traveled

500 XP

Distance Maker ­ƒÜÇ

total\_km field on trip ÔåÆ threshold trigger

Recruit 3 friends \(referral\)

400 XP

Trailblazer ­ƒîƒ

user\.registered with referral\_code ÔåÆ referrer XP

__  Ôûî Levels: Explorer \(0\) ÔåÆ Adventurer \(2000\) ÔåÆ Voyager \(8000\) ÔåÆ Legend \(25000\)\. Displayed on profile\. High ranks get early access to vendor deals and beta features\.  __

__20\.2 SOS & Safety Mode__

__Feature__

__Implementation__

__Tech Detail__

SOS Button

One\-tap emergency\. Hardcoded in bottom\-nav safety icon\. Requires 3\-second hold to prevent accidental trigger\.

Sends: GPS coordinates, trip\_id, user\_id to Safety Service\. Broadcasts to all sos\_contacts via SMS \(Twilio\) \+ push\.

Offline SOS

Works without internet via SMS\.

Twilio fallback: SMS with pre\-formatted emergency message \+ Google Maps link\.

Safe Check\-In

Admin sets check\-in interval \(e\.g\., every 6 hours\)\. Each member gets a push: 'Confirm you are safe'

If member doesn't confirm within 30min: escalation push to group\. Admin notified\. Emergency contact alerted if not confirmed in 1h\.

Trusted Contact Link

Share a read\-only live tracking link with non\-app contacts \(parents, friends\)\.

Short URL \(trip\.party/track/TOKEN\)\. Token valid until trip ends\. Shows member's last known location on a public map embed\.

Emergency Contacts

Pre\-set up to 5 contacts with name \+ phone\. Stored on trip\.safety\.sos\_contacts\.

Contacts set during trip planning\. Can be updated any time during active trip\.

Emergency Mode

Admin activates\. Broadcasts last known GPS of all members to emergency contacts instantly\.

Emergency mode overrides all privacy settings\. Sends SMS every 10 minutes until deactivated\.

__20\.3 Trip Soundtrack \(Collaborative Playlist\)__

__Feature__

__Detail__

__API__

Spotify Integration

Connect Spotify account\. Create a collaborative playlist per trip\. All members can add songs\.

Spotify Web API: create\-playlist, add\-tracks, collaborative=true

Auto\-Trip Playlist

AI suggests playlist based on destination \+ trip tags \(beach=pop, mountains=indie, city=hip\-hop\)\.

Spotify Recommendations API with seed\_genres and target\_energy

In\-App Playback

Play Spotify tracks directly in\-app while viewing trip map or timeline\.

Spotify iOS/Android SDK for in\-app playback \(requires Spotify app installed\)

__20\.4 Vendor Smart Pricing \(Dynamic Pricing Engine\)__

__Feature__

__Logic__

__Benefit__

Demand\-Based Pricing

Vendor can set: base\_price, peak\_multiplier \(e\.g\., 1\.5x on weekends\), floor\_price\. Platform applies automatically\.

Vendors maximize revenue on peak demand without manual price changes\.

Early Bird Discount

Vendor sets: book\_days\_in\_advance >= 7 ÔåÆ 10% discount automatically applied\.

Increases advance bookings\. Better vendor planning\.

Group Size Discount

booking\.guests\.length >= 5 ÔåÆ automatic 5% group discount\.

Incentivizes group bookings\. Higher transaction value per booking\.

Last\-Minute Deal

If availability\_calendar has slots within 24h: auto\-push 'Last Minute Deal' badge to nearby users\.

Fills empty inventory\. User sees exclusive deal\. Win\-win\.

__20\.5 Trip Visa & Document Assistant__

__Feature__

__Detail__

Visa Requirement Lookup

Based on origin nationality \+ destination country: show visa requirements, processing time, fees\. Data from Sherpa API or manual DB\.

Document Checklist

Auto\-generated checklist: passport, visa, travel insurance, vaccination records\. Based on destination \+ trip dates\.

Document Upload

Secure upload to isolated S3 bucket\. Only accessible by uploader\. Used for offline reference\. Never shared\.

Reminder System

Push reminders: 'Your passport expires in 60 days\. Your trip to Thailand is in 45 days\.'

__21\. Complete Monetization Strategy__

__Revenue Stream__

__Model__

__Price Point__

__Year 1 Target__

__Year 3 Target__

Booking Commission

Take rate

5ÔÇô8% per booking

Ôé╣50L GMV ÔåÆ Ôé╣3L revenue

Ôé╣10Cr GMV ÔåÆ Ôé╣70L revenue

Trip Party Pro \(B2C\)

Subscription

Ôé╣299/mo or Ôé╣2,499/yr

500 subscribers ÔåÆ Ôé╣1\.25Cr/yr

50,000 ÔåÆ Ôé╣12\.5Cr/yr

Vendor Subscription \(B2B\)

SaaS tiers

Ôé╣999ÔÇôÔé╣4,999/mo

200 vendors ÔåÆ Ôé╣30L/yr

5,000 vendors ÔåÆ Ôé╣12Cr/yr

Promoted Destinations

CPM / Flat fee

Ôé╣50,000ÔÇôÔé╣5L/campaign

5 campaigns ÔåÆ Ôé╣10L/yr

Tourism board partnerships

Travel Insurance Referral

Referral fee

10ÔÇô15% of premium

Ôé╣5L/yr

Ôé╣2Cr/yr

Expense Settlement Fee

Transaction fee

1% of settled amount

Ôé╣2L/yr

Ôé╣50L/yr

Vendor API Access

Per\-call

Ôé╣0\.50/API call

Ôé╣1L/yr

Ôé╣10L/yr

__21\.1 Pro Subscription Features__

__Feature__

__Free__

__Pro \(Ôé╣299/mo\)__

Trips

Max 3 concurrent

Unlimited

AI Trip Planner

3 uses/trip

Unlimited, GPT\-4o quality

Offline Maps

ÔÇö

Full offline tile packs for trip destinations

Memory Reel

480p, watermarked

1080p, no watermark, downloadable

Packing List AI

Basic \(rule\-based\)

Full LLM\-powered with smart suggestions

Expense Reports

Basic summary

PDF export, itemized, share with accountant

Safety Features

Basic SOS

SOS \+ Trusted Contact links \+ check\-in scheduler

Customer Support

Community forum

Priority 24h support

Ads

Standard feed ads

Ad\-free experience

Traveler Rank XP Boost

1x

1\.5x XP multiplier

