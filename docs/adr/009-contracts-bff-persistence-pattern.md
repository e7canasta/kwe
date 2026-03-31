# ADR 009: Contracts BFF Persistence Pattern

**Status:** Implementado con fallback local  
**Fecha:** 2026-03-31  
**Contexto:** Necesidad de exponer contratos draft persistibles desde `apps/web` sin bloquear el MVP por la integración final con CLM

---

## Resumen

Se incorporó una capa `/api/contracts` para cubrir el ciclo base de un draft contractual:
- listar contratos
- obtener detalle
- crear draft
- actualizar draft
- eliminar draft
- exportar

La implementación actual sigue un patrón **mock-first con proxy opcional a CLM**, de modo que el frontend puede desarrollar y validar el flujo completo aunque el backend definitivo todavía no esté cerrado.

---

## Decisión

Se decidió agregar una BFF dedicada en `apps/web`:

```text
src/app/api/contracts/
├── route.ts
└── [id]/
    ├── route.ts
    └── export/route.ts
```

Respaldada por:

```text
src/lib/contracts/contract-library.ts
```

El patrón elegido es:

1. Intentar proxy a CLM si existe configuración.
2. Si CLM no está configurado o falla, responder con mock local.
3. Mantener una forma de contrato estable hacia el frontend.
4. Dejar la migración a backend real encapsulada en una sola librería.

---

## Endpoints

- `GET /api/contracts`
- `POST /api/contracts`
- `GET /api/contracts/[id]`
- `PUT /api/contracts/[id]`
- `DELETE /api/contracts/[id]`
- `POST /api/contracts/[id]/export`

Todos pasan por `verifyUserAuthenticated()` antes de responder.

---

## Patrón de integración

### Proxy opcional

Si existe:
- `CLM_CONTRACTS_API_URL`, se usa como endpoint completo
- o `CLM_API_URL`, se deriva `.../contracts`

La BFF intenta primero CLM y reusa headers autenticados por API key.

### Fallback local

Si la llamada a CLM falla:
- `GET` responde desde catálogo mock en memoria
- `POST/PUT/DELETE` mutan el store mock en memoria
- `export` devuelve payload estructurado para PDF/DOCX sin depender de render real

---

## Razones

- Desbloquear el MVP mientras CLM y/o backend contractual evolucionan.
- Evitar que el frontend consuma CLM directo desde componentes.
- Reutilizar el patrón ya adoptado en `/api/clauses`, `/api/requests` y `/api/rules`.
- Dar una superficie estable para integrar luego persistencia real, export real y relación con requests.

---

## Consecuencias

### Positivas

- El flujo contractual queda navegable de punta a punta.
- `apps/web` puede validar UX en `LOCAL_UI_MODE` o sin CLM real.
- El frontend ya queda desacoplado del formato exacto de respuesta del servicio externo.

### Tradeoffs

- El store mock es volátil y se reinicia con el proceso.
- `export` todavía no genera archivos binarios reales.
- La relación `request -> thread -> contract` ya existe en el BFF/web layer, pero todavía no es canónica en un backend contractual definitivo.

---

## Archivos clave

- `src/app/api/contracts/route.ts`
- `src/app/api/contracts/[id]/route.ts`
- `src/app/api/contracts/[id]/export/route.ts`
- `src/lib/contracts/contract-library.ts`

---

## Recomendación futura

El siguiente paso natural es mover esta relación a persistencia real compartida con backend/agents, evitando que su estado fuente viva solamente en `apps/web`.
