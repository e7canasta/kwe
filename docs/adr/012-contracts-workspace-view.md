# ADR 012: Contracts Workspace View

**Status:** Implementado  
**Fecha:** 2026-03-31  
**Contexto:** `/api/contracts` ya existía para persistencia y export, pero seguía siendo una capacidad invisible en la navegación principal del workspace

---

## Resumen

Se decidió exponer los contratos persistidos como una vista explícita dentro de `ThreadHistory`, junto a:

- conversaciones
- requests
- contratos

La vista lista drafts persistidos desde `/api/contracts` y permite:

1. abrir el thread ya ligado al contrato
2. crear un thread dedicado si todavía no existe
3. relinkear `threadId` al contrato cuando sea necesario

---

## Problema

Antes de esta decisión:

- `contracts` existía solo como capa BFF
- el usuario podía exportar o persistir drafts sin tener una lista navegable de esos contratos
- reabrir un draft contractual dependía de recordar el thread o de venir desde `Requests`

Eso dejaba una superficie importante del MVP sin entrada de navegación propia.

---

## Decisión

Se incorporó una tercera pestaña `Contracts` en `ThreadHistory`:

```text
Workspace
  ├── Conversations
  ├── Requests
  └── Contracts
```

La vista:

- consulta `GET /api/contracts`
- filtra por `status`
- busca por título, parte, tipo, request o IDs
- muestra si el contrato ya tiene thread ligado
- abre o crea el thread con `ensureContractDraftThread(...)`

---

## Arquitectura

### Cliente de contratos

```text
src/lib/contracts/contract-client.ts
```

### Orquestación de thread contractual

```text
src/lib/contracts/contract-threading.ts
```

### UI

```text
src/components/contracts-panel/
├── contract-card.tsx
└── contract-filters.tsx
```

### Integración

```text
src/components/chat-interface/thread-history.tsx
```

---

## Razones

- Dar visibilidad real a `/api/contracts`
- Permitir retomar drafts persistidos aunque no provengan de `Requests`
- Reusar el modelo de thread como unidad de trabajo del canvas
- Evitar que el usuario dependa del historial de conversaciones para encontrar contratos

---

## Consecuencias

### Positivas

- el workspace ya navega por conversaciones, intake y contratos persistidos
- contratos sin thread previo pueden abrirse en un thread nuevo on-demand
- la relación `contract -> thread` se estabiliza progresivamente desde la UI

### Tradeoffs

- la vista vive hoy dentro de `ThreadHistory`, no como módulo independiente
- el listado usa filtros básicos de status y texto, no una grilla avanzada
- si el backend contractual cambia su shape, el cliente liviano de hidratación debe mantenerse sincronizado

---

## Archivos clave

- `src/lib/contracts/contract-client.ts`
- `src/lib/contracts/contract-threading.ts`
- `src/components/contracts-panel/contract-card.tsx`
- `src/components/contracts-panel/contract-filters.tsx`
- `src/components/chat-interface/thread-history.tsx`
- `src/app/api/contracts/route.ts`

---

## Recomendación futura

Si el producto gana volumen de contratos, esta vista debería evolucionar desde tab compacto de workspace a panel o página dedicada, manteniendo el helper de reapertura de thread como capa reutilizable.
