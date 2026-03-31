# ADR 010: Request, Thread and Contract Linkage

**Status:** Implementado  
**Fecha:** 2026-03-31  
**Contexto:** Una request podía abrir múltiples drafts sin una relación persistida y visible entre intake, thread de drafting y contrato resultante

---

## Resumen

Se decidió volver explícita la relación:
- request origen
- thread dedicado de drafting
- contrato draft persistido

La implementación actual vive en `apps/web` y combina:
- metadata operativa en el thread
- persistencia de `requestId` y `threadId` en `/api/contracts`
- reapertura idempotente desde `RequestsPanel` y `ThreadHistory`

---

## Problema

Antes de esta decisión:
- una misma request podía crear más de un thread seedado
- el contrato draft no quedaba necesariamente enlazado al thread que lo originó
- la UI no distinguía entre “crear draft” y “reabrir draft existente”

Eso erosionaba trazabilidad y generaba riesgo de drafts zombie o inconsistentes.

---

## Decisión

Se decidió introducir una capa de orquestación cliente en:

```text
src/lib/contracts/request-drafting.ts
```

Responsable de:

1. Buscar si ya existe un thread para una request por `metadata.request_id`
2. Crear el thread seedado sólo si no existe
3. Buscar si ya existe un contrato asociado a la request
4. Crear el contrato si falta
5. Sincronizar `threadId` en el contrato si quedó desalineado
6. Actualizar metadata operativa del thread con:
   - `request_id`
   - `request_status`
   - `request_type`
   - `contract_id`
   - `contract_type`
   - `supplier_name`

---

## Patrón operativo

```text
Request seleccionada
  → ensureRequestDraftThread(...)
    → findThreadForRequest(...)
    → createThread(...) si falta
    → GET /api/contracts?requestId=...
    → POST /api/contracts si falta contrato
    → PUT /api/contracts/[id] si falta alinear threadId
    → updateThreadMetadata(...)
  → abrir thread resultante
```

---

## Razones

- Evitar duplicación de drafts para la misma request
- Preservar trazabilidad entre intake y drafting
- Dejar visible en UI cuándo una request ya tiene draft vivo
- Preparar la futura integración con backend/agents sin bloquear el MVP

---

## Consecuencias

### Positivas

- `Start Draft` se vuelve idempotente a nivel UX
- `RequestsPanel` y `ThreadHistory` pueden mostrar requests ya enlazadas
- La metadata del thread pasa a ser suficiente para navegación operativa rápida
- El workspace puede exponer contexto contractual sin abrir el draft completo

### Tradeoffs

- La relación sigue viviendo en el web/BFF layer y no en una fuente canónica externa
- La búsqueda del contrato por `requestId` depende del comportamiento estable de `/api/contracts`
- El paso siguiente sigue siendo consolidar esta relación en backend real

---

## Archivos clave

- `src/lib/contracts/request-drafting.ts`
- `src/contexts/ThreadProvider.tsx`
- `src/lib/mock/local-ui.ts`
- `src/lib/contracts/contract-library.ts`
- `src/app/api/contracts/route.ts`
- `src/app/api/contracts/[id]/route.ts`
- `src/components/requests-panel/index.tsx`
- `src/components/requests-panel/request-card.tsx`
- `src/components/requests-panel/request-detail.tsx`
- `src/components/chat-interface/thread-history.tsx`

---

## Recomendación futura

Cuando el equipo de `apps/agents` o el backend contractual tome ownership de esta relación, el contrato de integración debería preservar estas claves operativas en el thread, aunque la fuente canónica deje de estar en `apps/web`.
