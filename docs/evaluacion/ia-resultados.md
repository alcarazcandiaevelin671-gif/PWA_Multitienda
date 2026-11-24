# Evaluación offline del motor de recomendación

Fecha: 2026-11-24 · Protocolo: leave-one-out sobre un producto del último pedido NUEVO para el cliente, Top-5, excluyendo lo que ya compró o marcó como favorito · Script: `node scripts/ia/evaluar-recomendaciones.mjs`

## A) Conjunto simulado (reproducible)

30 comercios, 120 productos en 10 rubros, 400 clientes; semilla 2026

### Recomendación personalizada

| Modelo | Casos | HitRate@5 (IC 95 %) | Precision@5 | NDCG@5 | MRR@5 | Productos distintos recomendados |
|---|---|---|---|---|---|---|
| Aleatorio | 307 | 4.2 % (2.5 % a 7.1 %) | 0.8 % | 0.021 | 0.013 | 120 |
| Popularidad | 307 | 10.4 % (7.5 % a 14.3 %) | 2.1 % | 0.082 | 0.074 | 9 |
| Contenido (TF-IDF) | 307 | 18.9 % (14.9 % a 23.6 %) | 3.8 % | 0.121 | 0.098 | 95 |
| Colaborativo (ítem-ítem) | 307 | 26.1 % (21.5 % a 31.2 %) | 5.2 % | 0.166 | 0.135 | 109 |
| Híbrido | 307 | 25.1 % (20.6 % a 30.2 %) | 5.0 % | 0.161 | 0.131 | 108 |

### Productos complementarios (carrito con 1 producto → ¿sugiere otro del mismo pedido?)

| Modelo | Casos | HitRate@5 (IC 95 %) | Precision@5 | NDCG@5 | MRR@5 | Productos distintos recomendados |
|---|---|---|---|---|---|---|
| Aleatorio | 245 | 4.5 % (2.5 % a 7.9 %) | 0.9 % | 0.028 | 0.022 | 120 |
| Popularidad | 245 | 18.4 % (14.0 % a 23.7 %) | 3.7 % | 0.141 | 0.127 | 7 |
| Complementarios (motor) | 245 | 43.3 % (37.2 % a 49.5 %) | 8.7 % | 0.326 | 0.291 | 119 |

### Arranque en frío (cliente sin historial)

| Modelo | Casos | HitRate@5 (IC 95 %) | Precision@5 | NDCG@5 | MRR@5 | Productos distintos recomendados |
|---|---|---|---|---|---|---|
| Aleatorio | 400 | 4.3 % (2.7 % a 6.7 %) | 0.9 % | 0.024 | 0.019 | 120 |
| Popularidad | 400 | 12.0 % (9.2 % a 15.6 %) | 2.4 % | 0.077 | 0.063 | 7 |
| Motor en frío (popularidad + cercanía) | 400 | 11.3 % (8.5 % a 14.7 %) | 2.3 % | 0.072 | 0.058 | 26 |

### Robustez: HitRate@5 en 10 simulaciones distintas (semillas 1 a 10)

| Modelo | Media | Desvío | Mínimo | Máximo |
|---|---|---|---|---|
| Aleatorio | 4.7 % | 1.4 % | 2.1 % | 6.5 % |
| Popularidad | 8.1 % | 1.3 % | 6.5 % | 10.8 % |
| Contenido (TF-IDF) | 21.7 % | 2.0 % | 18.4 % | 25.2 % |
| Colaborativo (ítem-ítem) | 27.5 % | 3.1 % | 21.1 % | 32.6 % |
| Híbrido | 29.3 % | 1.9 % | 25.9 % | 31.7 % |

> El conjunto simulado se genera con preferencias por rubro, complementos y cercanía, las mismas señales que usa el modelo: permite comparar modelos, no predice el desempeño con clientes reales.

## B) Datos reales del prototipo (base de prueba)

Productos: 11 · Comercios activos: 5 · Clientes con pedidos: 3 · Pedidos: 11 (con 2+ productos: 1)

### Recomendación personalizada (datos reales)

| Modelo | Casos | HitRate@5 (IC 95 %) | Precision@5 | NDCG@5 | MRR@5 | Productos distintos recomendados |
|---|---|---|---|---|---|---|
| Aleatorio | 2 | 50.0 % (9.5 % a 90.5 %) | 10.0 % | 0.215 | 0.125 | 7 |
| Popularidad | 2 | 0.0 % (0.0 % a 65.8 %) | 0.0 % | 0.000 | 0.000 | 6 |
| Contenido (TF-IDF) | 2 | 100.0 % (34.2 % a 100.0 %) | 20.0 % | 0.531 | 0.375 | 6 |
| Colaborativo (ítem-ítem) | 2 | 0.0 % (0.0 % a 65.8 %) | 0.0 % | 0.000 | 0.000 | 0 |
| Híbrido | 2 | 50.0 % (9.5 % a 90.5 %) | 10.0 % | 0.315 | 0.250 | 8 |

> Con tan pocos casos el resultado no es estadísticamente significativo; se informa por transparencia.