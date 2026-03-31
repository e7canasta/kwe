# ADR 007: Requests Panel and Seeded Draft Threads

**Status:** Implementado  
**Fecha:** 2026-03-31  
**Contexto:** Integración de solicitudes pendientes del CLM con el sistema de threads del canvas

---

## Resumen

Cada request del CLM que entra en drafting debe convertirse en un thread dedicado, con:
- artifact inicial
- mensajes iniciales
- metadata asociada a la request

No se reutiliza el thread activo del usuario para evitar mezclar contextos y perder trazabilidad.

---

## Decisión

Se decidió que `Start Draft` y la pestaña `Requests` creen o abran **threads seedados por request**, en lugar de reusar el thread actual.

La semilla de un thread se define como:
- `title`
- `metadata`
- `initialValues`

`ThreadProvider` fue extendido para soportar esta creación tanto en remoto como en `LOCAL_UI_MODE`.

---

## Arquitectura

### UI

```text
src/components/requests-panel/
├── index.tsx
├── request-card.tsx
├── request-detail.tsx
├── request-filters.tsx
└── loading-skeleton.tsx
```

### Seed data

```text
src/lib/contracts/request-library.ts
```

### Thread orchestration

```text
src/contexts/ThreadProvider.tsx
src/components/chat-interface/thread-history.tsx
```

---

## Flujo

```text
Usuario abre Requests Panel
  → consulta /api/requests
  → selecciona request
  → Start Draft
    → createRequestThreadSeed(...)
    → ThreadProvider.createThread({ title, metadata, initialValues })
    → thread queda listo con artifact y contexto inicial
```

---

## Razones

- Mantener aislamiento de contexto por request.
- Preservar trazabilidad entre intake y drafting.
- Facilitar futura auditoría o review por request.
- Reutilizar el modelo de thread existente sin crear un sistema paralelo.

---

## Consecuencias

### Positivas

- Cada draft tiene identidad y metadata propias desde el inicio.
- La experiencia es consistente entre modo real y `LOCAL_UI_MODE`.
- `ThreadHistory` puede mostrar requests como entrada operativa, no solo como lista separada.

### Tradeoffs

- Se crean más threads, lo que exige buena navegación en historial.
- La semilla inicial debe mantenerse sincronizada con el modelo de request del CLM.

---

## Archivos clave

- `src/components/requests-panel/index.tsx`
- `src/components/requests-panel/request-filters.tsx`
- `src/components/chat-interface/thread-history.tsx`
- `src/contexts/ThreadProvider.tsx`
- `src/lib/contracts/request-library.ts`
- `src/app/api/requests/route.ts`
- `src/app/api/requests/[id]/route.ts`

---

## Evolución posterior

La persistencia de la relación:
- request origen
- thread de drafting
- contrato resultante

fue implementada luego en el ADR `010`, manteniendo este ADR enfocado en el patrón original de thread seeding.
