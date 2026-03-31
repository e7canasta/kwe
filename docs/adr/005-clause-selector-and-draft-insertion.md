# ADR 005: Clause Selector and Draft Insertion Pattern

**Status:** Implementado con fallback local  
**Fecha:** 2026-03-31  
**Contexto:** Reemplazo del patrón de Web Search por una librería de cláusulas orientada a drafting contractual

---

## Resumen

El producto reemplaza el panel lateral de búsqueda web por un `ClauseSelector` que permite:
- navegar categorías de cláusulas
- previsualizar contenido contractual
- seleccionar múltiples cláusulas
- validar compatibilidad antes de insertar
- insertar en el draft actual

La inserción ocurre localmente por defecto en `apps/web`, pero se dejó una costura explícita para migrar a LangGraph mediante feature flag y BFF.

---

## Decisión

Se decidió adoptar un patrón **local-first con migración preparada**:

1. El catálogo y la UX de selección viven en frontend.
2. La validación pasa por `/api/rules/validate` con fallback local.
3. La inserción del markdown ocurre localmente mientras `apps/agents` no implemente `insertClause`.
4. Si `NEXT_PUBLIC_AGENT_CLAUSE_INSERTION_ENABLED=true`, el frontend intenta `POST /api/draft/clauses/insert`.
5. Si esa integración no está lista, vuelve a inserción local sin romper la experiencia.

---

## Arquitectura

### Componentes

```text
src/components/clause-selector/
├── index.tsx
├── clause-card.tsx
├── clause-categories.tsx
├── clause-preview.tsx
└── loading-skeleton.tsx
```

### Estado compartido

`GraphContext` expone:
- `clauseSelectorOpen`
- `selectedClauses`
- `setClauseSelectorOpen`
- `setSelectedClauses`

### APIs

- `GET /api/clauses`
- `GET /api/clauses/categories`
- `GET /api/clauses/[id]`
- `POST /api/rules/validate`
- `POST /api/draft/clauses/insert` (costura futura con LangGraph)

### Helpers

`src/lib/contracts/draft-tools.ts` concentra:
- `validateSelectedClauses(...)`
- `clausesToMarkdown(...)`
- `insertClausesIntoArtifact(...)`

---

## Flujo de interacción

```text
Usuario abre Clause Selector
  → carga categorías y cláusulas
  → selecciona una o más cláusulas
  → ejecuta validación
    → si falla: no inserta
    → si pasa:
      → flag OFF: inserción local en artifact
      → flag ON: intenta BFF draft/clauses/insert
        → si falla: fallback local
```

---

## Razones

- Desacopla Sprint 2/3 del paquete `apps/agents`.
- Conserva una UX rápida y estable para drafting.
- Permite avanzar en producto sin bloquearse por el nodo `insertClause`.
- Deja una interfaz concreta para migración posterior.

---

## Consecuencias

### Positivas

- El usuario ya puede trabajar con cláusulas sin dependencia del backend de agentes.
- La futura integración con LangGraph no requiere rediseñar la UI.
- La validación y la inserción están separadas, lo que simplifica debugging.

### Tradeoffs

- La inserción local no incorpora todavía inteligencia de composición del grafo.
- El orden de inserción hoy es append al draft activo.
- Puede existir divergencia temporal entre la heurística local y la futura lógica del nodo `insertClause`.

---

## Archivos clave

- `src/components/clause-selector/index.tsx`
- `src/contexts/GraphContext.tsx`
- `src/app/api/clauses/*`
- `src/app/api/draft/clauses/insert/route.ts`
- `src/lib/contracts/draft-tools.ts`
- `docs/langgraph-insert-clause-integration.md`

---

## Recomendación futura

Cuando `apps/agents` implemente `insertClause`, el comportamiento objetivo debería ser:
- validar y decidir en backend
- devolver `ArtifactV3` actualizado
- mantener el fallback local solo como red de seguridad transitoria
