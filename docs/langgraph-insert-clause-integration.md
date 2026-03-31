# LangGraph Insert Clause Integration

## Objetivo

Mantener la inserción de cláusulas operativa desde `apps/web` hoy, pero dejar definida la costura para que el equipo de `apps/agents` implemente el nodo `insertClause` sin rediseñar el frontend después.

Estado actual al 2026-03-31:
- `ClauseSelector` inserta cláusulas localmente por defecto.
- Si `NEXT_PUBLIC_AGENT_CLAUSE_INSERTION_ENABLED=true`, el frontend intenta usar `POST /api/draft/clauses/insert`.
- Si la integración no está lista o falla, el frontend cae en fallback local.

## Feature Flag

Variable:

```bash
NEXT_PUBLIC_AGENT_CLAUSE_INSERTION_ENABLED=true
```

Comportamiento:
- `false` o ausente: inserción local en frontend.
- `true`: prueba la ruta BFF de draft; si devuelve error o `501`, hace fallback local.

## Contrato BFF

Ruta:

```http
POST /api/draft/clauses/insert
```

Payload esperado:

```json
{
  "threadId": "thread_123",
  "artifact": {
    "currentIndex": 1,
    "contents": [
      {
        "index": 1,
        "type": "text",
        "title": "Supplier Request Draft",
        "fullMarkdown": "..."
      }
    ]
  },
  "selectedClauseIds": ["payment_net_30", "termination_for_cause"],
  "insertClauseAtPosition": 1482
}
```

Notas:
- `threadId` puede venir `null` en drafts todavía no persistidos.
- `artifact` representa el estado actual visible en canvas.
- `selectedClauseIds` es el input contractual mínimo que ya existe en `GraphInput`.
- `insertClauseAtPosition` hoy es el largo del markdown activo; si el nodo soporta inserción posicionada, puede usarlo. Si no, puede appendear al final.

## Respuesta Esperada

Respuesta exitosa:

```json
{
  "source": "langgraph",
  "artifact": {
    "currentIndex": 2,
    "contents": [
      {
        "index": 1,
        "type": "text",
        "title": "Supplier Request Draft",
        "fullMarkdown": "..."
      },
      {
        "index": 2,
        "type": "text",
        "title": "Supplier Request Draft",
        "fullMarkdown": "..."
      }
    ]
  }
}
```

Respuesta no disponible todavía:

```json
{
  "error": "LangGraph clause insertion is not configured.",
  "fallback": "local"
}
```

## Responsabilidad del Equipo Agents

El equipo de `apps/agents` debería implementar:

1. Un nodo `insertClause` en LangGraph.
2. Resolución de `selectedClauseIds` contra la librería/API de cláusulas.
3. Inserción en el artifact markdown actual.
4. Nueva versión del draft si quieren mantener versionado; el frontend ya soporta recibir `ArtifactV3` completo.
5. Respuesta JSON con `artifact` actualizado.

## Sugerencia de Routing en LangGraph

Entrada relevante ya disponible en shared types:

```ts
selectedClauseIds?: string[];
insertClauseAtPosition?: number;
artifact?: ArtifactV3;
```

Routing sugerido:
- Si `selectedClauseIds.length > 0`, derivar a `insertClause`.
- Si además hay reglas activas, validar antes de mutar el draft.
- Si falla la validación, devolver error estructurado y no mutar el artifact.

## Configuración del Proxy

La BFF usa:

```bash
LANGGRAPH_INSERT_CLAUSE_PATH=/draft/clauses/insert
```

Puede ser:
- un path relativo sobre `LANGGRAPH_API_URL`
- o una URL absoluta

## Rollout

1. Mantener `NEXT_PUBLIC_AGENT_CLAUSE_INSERTION_ENABLED=false` en producción mientras el nodo no exista.
2. Implementar el endpoint/nodo del lado agentes.
3. Probar con el flag encendido en staging.
4. Cuando la respuesta del nodo sea estable, dejar el fallback local como red de seguridad hasta cerrar la migración.
