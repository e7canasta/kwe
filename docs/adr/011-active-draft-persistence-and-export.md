# ADR 011: Active Draft Persistence and Export

**Status:** Implementado  
**Fecha:** 2026-03-31  
**Contexto:** El botón de export del contrato no debía depender solamente de drafts originados desde `Requests`, ni exportar una copia desactualizada respecto al markdown visible en el canvas

---

## Resumen

Se decidió que la acción de export desde el header del artifact:

1. resuelva el thread activo
2. persista o sincronice el draft actual en `/api/contracts`
3. enlace `contract_id` al thread si todavía no existe
4. recién después dispare `/api/contracts/[id]/export`

Con esto, cualquier draft activo puede exportarse aunque no haya nacido desde una request.

---

## Problema

Antes de esta decisión:

- el export sólo era viable si el thread ya tenía `contract_id`
- drafts creados fuera del flujo `Requests` no podían exportarse
- un contrato ya persistido podía quedar desactualizado respecto al markdown activo

Eso dejaba una UX inconsistente y hacía que el export dependiera de cómo había empezado el drafting.

---

## Decisión

Se implementó persistencia on-demand desde la UI del artifact header:

```text
ArtifactHeader
  → ContractExportMenu
    → useActiveThread()
    → POST /api/contracts si falta contract_id
    → PUT /api/contracts/[id] si ya existe
    → updateThreadMetadata({ contract_id })
    → POST /api/contracts/[id]/export
```

La sincronización usa como fuente:

- `currentArtifactContent.title`
- `currentArtifactContent.fullMarkdown`
- `selectedClauses` actuales normalizadas a `SelectedClause`
- `thread.metadata.contract_type`
- `thread.metadata.request_id`

---

## Razones

- Hacer que exportar sea una capacidad del draft activo, no de un flujo específico
- Evitar exportar una versión persistida vieja
- Reusar `/api/contracts` como capa de persistencia única del draft
- Preservar el thread como punto de navegación y trazabilidad

---

## Consecuencias

### Positivas

- cualquier draft puede persistirse y exportarse desde el canvas
- el primer export deja enlazado `contract_id` al thread
- export refleja el markdown visible al momento de la acción

### Tradeoffs

- export en modo mock sigue descargando contenido textual con extensión `pdf` o `docx`
- `selectedClauses` se normaliza desde el estado de UI y no desde una fuente canónica de cláusulas persistidas
- la persistencia sigue ocurriendo desde `apps/web`, no desde un backend contractual definitivo

---

## Archivos clave

- `src/hooks/useActiveThread.ts`
- `src/components/artifacts/header/contract-export-menu.tsx`
- `src/components/artifacts/header/index.tsx`
- `src/components/artifacts/ArtifactRenderer.tsx`
- `src/app/api/contracts/[id]/export/route.ts`

---

## Recomendación futura

Cuando exista persistencia contractual real fuera de `apps/web`, esta acción debería seguir sincronizando el draft activo antes de exportar, pero delegando la fuente canónica a backend.
