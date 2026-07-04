# Local Sync Server (para AppVentas)

Este servidor local mínimo sirve para que la app tenga un endpoint donde sincronizar.

## Arrancar

1) Instala dependencias:

npm install

2) Inicia:

npm start

Por defecto escucha en:
- http://127.0.0.1:3001

## Endpoints

- GET  /health
- POST /api/sales

Idempotencia:
- Si llega una venta con `sale.id` ya existente, responde 409 (deduplicación).

