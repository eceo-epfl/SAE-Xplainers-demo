# umap-demo

Vue 3 + Vite app.

## Minimal prerequisites

You need at least one of these:

- `Node.js` + `npm` (to run locally)
- `Docker` + `Docker Compose` (to run in container)

Quick checks:

```sh
node -v
npm -v
docker --version
docker compose version
```

If a command is not found, install the missing tool:

- Node.js (includes npm): <https://nodejs.org/>
- Docker Desktop (includes Docker Compose): <https://www.docker.com/products/docker-desktop/>

## Run locally (without Docker)

From the `umap-demo` folder:

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Open: <http://localhost:5173>

## Run with Docker Compose

From the `umap-demo` folder:

```sh
docker compose up --build
```

Open: <http://localhost:5173>

To stop it from running in the background:

```sh
docker compose down
```
