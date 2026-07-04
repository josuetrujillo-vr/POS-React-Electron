const express = require('express');
const cors = require('cors');

// Servidor local mínimo para sincronización POS.
// - Recibe POST /api/sales con ventas
// - Idempotencia por sale.id: si ya existe responde 409
// - Responde 200/409 según deduplicación
// - Almacena en memoria (puedes cambiar a persistencia si lo deseas)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// "Base" en memoria
const seenSales = new Map(); // saleId -> sale

function normalizeSaleId(body) {
  return body && typeof body === 'object' ? body.id : undefined;
}

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/sales', (req, res) => {
  const sale = req.body;
  const saleId = normalizeSaleId(sale);

  if (!saleId || typeof saleId !== 'string') {
    return res.status(400).json({ error: 'Missing sale.id (UUID)' });
  }

  if (seenSales.has(saleId)) {
    // Deduplicación
    return res.status(409).json({ error: 'Sale already synced', saleId });
  }

  seenSales.set(saleId, sale);
  return res.status(200).json({ ok: true, saleId });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[local-sync-server] listening on http://127.0.0.1:${PORT}`);
});

