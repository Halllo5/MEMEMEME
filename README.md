# MEMEMEME

I wrote this meme organizer to learn Qwik, and I actually really enjoyed it. 10/10 would recommend :)
It has search and a friend/buddy system to share memes with friends, but it's not quite feature complete and will have some issues.

## What it does

- Upload images(to s3 compatible storage) with captions and privacy settings
- OCR extracts text automatically
- Search by text or vector similarity
- Buddy system for sharing

## Tech

- Qwik frontend + backend with bun
- PostgreSQL with pgvector
- S3-compatible storage
- Python FastAPI for OCR/vectorization
- OIDC auth

## Setup

Need: Bun, Docker/Podman, Python 3.13+, OIDC provider

```bash
# Install deps
bun install
cd processing && uv sync && cd ..

# Start services
docker-compose up -d

# Start app
bun run start

# Start processing service
cd processing && uv run fastapi dev main.py
```

## Environment variables

Copy `.env.example` to `.env` in both root and `processing/` directories.

## Dev

```bash
bun run start  # Main app
cd processing && uv run fastapi dev main.py  # Processing service
```

## Build

```bash
bun run build
bun run serve  # Production server
```

## Running in Prod?

Why would you, but everything is Dockerized and should work. Let's hope it's secure xDD
