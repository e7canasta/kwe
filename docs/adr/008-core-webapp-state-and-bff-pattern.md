# ADR 008: Core Webapp State, Worker and BFF Pattern

**Status:** Referencia activa para desarrollo  
**Fecha:** 2026-03-31  
**Contexto:** Hallazgos sobre el núcleo de diseño y arquitectura de `apps/web` que conviene respetar al agregar features nuevas

---

## Resumen

La webapp no es una colección de componentes aislados. Su arquitectura gira alrededor de un núcleo claro:

1. **Contexts** para estado duradero y coordinación
2. **Worker** para streaming de LangGraph
3. **BFF** para autenticación, proxy y desacople de servicios
4. **Feature flags** y fallbacks para migración progresiva

Las features que mejor encajan en este core son las que se integran a esas capas, en vez de resolver todo con fetches locales dispersos.

---

## Capas

### 1. UI / Components

Responsables de:
- render
- interacción
- delegación a contexts o rutas BFF

Ejemplos:
- `ClauseSelector`
- `RequestsPanel`
- `ContractToolbar`
- `Canvas`

### 2. Contexts

Responsables de:
- estado compartido
- reglas de coordinación
- persistencia o bridge con backends

Contextos clave:
- `GraphContext.tsx`: mensajes, artifact, streaming, selección contractual
- `ThreadProvider.tsx`: creación/cambio de threads, `threadId` en URL
- `AssistantContext.tsx`: asistente activo y metadata

### 3. Worker de streaming

`src/workers/graph-stream/stream.worker.ts` desacopla el stream del hilo principal.

Principio:
- la UI no debería hablar directamente con streaming complejo
- el worker centraliza la interacción con `client.runs.stream(...)`

### 4. BFF

`src/app/api/[..._path]/route.ts` y rutas específicas:
- agregan auth
- ocultan API keys
- permiten fallback local o proxy a servicios concretos

Principio:
- servicios externos no se consumen directo desde componentes si forman parte del flujo de negocio

---

## Patrones recomendados para features nuevas

### Patrón A — Estado local + Context

Usar cuando:
- la feature modifica artifact, mensajes o selección compartida
- varios componentes necesitan el mismo estado

Ejemplo:
- `ClauseSelector` usa `GraphContext`

### Patrón B — UI + ruta BFF dedicada

Usar cuando:
- la feature depende de un servicio backend específico
- no necesita pasar por el stream principal de LangGraph

Ejemplos:
- `/api/clauses`
- `/api/rules/*`
- `/api/requests`

### Patrón C — UI + BFF + LangGraph

Usar cuando:
- la operación debe formar parte del flujo orquestado del grafo
- la respuesta ideal vuelve como artifact o stream

Ejemplos:
- `/api/[..._path]`
- `/api/draft/clauses/insert`

---

## Decisiones derivadas

### No bypass de providers

Si una feature toca threads, artifact o mensajes, no debería resolverlo solo en estado local del componente.

### Local UI mode es una costura de arquitectura, no solo un mock

`NEXT_PUBLIC_LOCAL_UI_MODE` permite:
- validar UX sin backends
- probar feature flags
- mantener desarrollo desacoplado de servicios aún no implementados

### Feature flags primero, migración después

Para features que dependen de otro equipo o servicio:
- dejar interfaz estable en frontend
- agregar flag
- usar fallback local

---

## Anti-patrones a evitar

- fetch directo desde componentes para flujos de negocio complejos
- estado duplicado entre componentes y contexts
- features que dependan de LangGraph sin costura BFF
- features que rompan `LOCAL_UI_MODE`
- mutaciones destructivas del artifact cuando el patrón existente ya soporta versionado

---

## Archivos que conviene entender antes de tocar el core

- `src/contexts/GraphContext.tsx`
- `src/contexts/ThreadProvider.tsx`
- `src/contexts/AssistantContext.tsx`
- `src/workers/graph-stream/stream.worker.ts`
- `src/app/api/[..._path]/route.ts`
- `src/lib/feature-flags.ts`
- `src/lib/mock/local-ui.ts`

---

## Recomendación operativa

Para cualquier feature nueva del MVP contractual, decidir explícitamente primero:

1. ¿Es solo UI?
2. ¿Necesita estado compartido?
3. ¿Necesita BFF dedicado?
4. ¿Necesita LangGraph o alcanza con fallback local?

Esa decisión debería tomarse antes de escribir componentes, porque en esta webapp la arquitectura correcta depende más del flujo de datos que del render.
