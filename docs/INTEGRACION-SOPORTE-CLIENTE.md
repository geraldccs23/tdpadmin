# Integración de Soporte TDP — Documentación para Implementaciones Cliente

## Filosofía

Cada implementación (restaurante, tienda, distribuidora, etc.) tiene su propio panel web.
Desde ese panel, el cliente y sus usuarios pueden contactar soporte técnico sin salir de su entorno.
Todos los tickets llegan centralizados a TDP Admin. Nosotros gestionamos, ellos reciben respuesta.

El cliente **nunca** entra a `admin.tallerdepixeles.com`. Todo ocurre desde su propia app.

---

## 1. Autenticación

Todas las peticiones llevan el header:

```
x-api-token: <PUBLIC_API_TOKEN>
```

El token se configura en el `.env` del proyecto implementación:

```env
VITE_TDP_SUPPORT_TOKEN=tu-token-aqui
```

---

## 2. Base URL

```
https://api.admin.tallerdepixeles.com/api/public
```

---

## 3. Endpoints

### 3.1 Crear Ticket

```
POST /api/public/tickets
```

**Body:**

```json
{
  "client_email": "usuario@implementacion.com",
  "client_name": "Nombre del Usuario",
  "title": "No puedo acceder al modulo de inventario",
  "description": "Desde esta mañana al intentar entrar a inventario me sale error 500.",
  "priority": "high",
  "category": "support",
  "source_implementation": "restaurant-rg7"
}
```

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `client_email` | string | sí | — | Email del usuario que reporta |
| `client_name` | string | sí | — | Nombre del usuario |
| `title` | string | sí | — | Título del ticket |
| `description` | string | no | `""` | Descripción detallada |
| `priority` | string | no | `"normal"` | `low`, `normal`, `high`, `urgent` |
| `category` | string | no | `"general"` | `support`, `billing`, `feature`, `bug`, `general` |
| `source_implementation` | string | no | `""` | Slug identificador de la implementación (ej: `restaurant-rg7`, `dist-mendoza`) |

**Auto-asignación:** Si el `client_email` coincide con un cliente registrado en `tdpadmin.clients`, se vincula automáticamente.

**Respuesta:**

```json
{
  "ok": true,
  "ticket": {
    "id": "uuid-del-ticket",
    "ticket_number": "TCK-202607-00042",
    "title": "No puedo acceder al modulo de inventario",
    "status": "open",
    "priority": "high",
    "category": "general",
    "source": "api",
    "client_email": "usuario@implementacion.com",
    "client_name": "Nombre del Usuario",
    "created_at": "2026-07-21T14:30:00Z"
  }
}
```

---

### 3.2 Listar Tickets

```
GET /api/public/tickets?client_email=usuario@implementacion.com
```

| Parámetro | Requerido | Descripción |
|-----------|-----------|-------------|
| `client_email` | sí | Email del cliente para filtrar sus tickets |
| `status` | no | Filtrar por estado |

**Respuesta:**

```json
{
  "ok": true,
  "tickets": [
    {
      "id": "uuid",
      "ticket_number": "TCK-202607-00042",
      "title": "No puedo acceder al modulo de inventario",
      "status": "open",
      "priority": "high",
      "source": "api",
      "client_email": "usuario@implementacion.com",
      "created_at": "2026-07-21T14:30:00Z"
    }
  ]
}
```

---

### 3.3 Ver Detalle

```
GET /api/public/tickets/:id?client_email=usuario@implementacion.com
```

`client_email` es obligatorio. Si el ticket no pertenece a ese email, retorna 404.

---

### 3.4 Obtener Mensajes

```
GET /api/public/tickets/:id/messages?client_email=usuario@implementacion.com
```

Solo retorna mensajes donde `is_internal = false`. Las notas internas de TDP Admin **nunca** se exponen.

**Respuesta:**

```json
{
  "ok": true,
  "messages": [
    {
      "id": "uuid",
      "message": "Hola, ya revisamos el problema. ¿Puedes intentar de nuevo?",
      "author_type": "internal",
      "sender_name": "Soporte TDP",
      "created_at": "2026-07-21T15:00:00Z"
    }
  ]
}
```

---

### 3.5 Enviar Mensaje

```
POST /api/public/tickets/:id/messages
```

**Body:**

```json
{
  "client_email": "usuario@implementacion.com",
  "message": "Ya intenté de nuevo y sigue igual."
}
```

Reglas:
- `client_email` es obligatorio para validar propiedad
- Si el ticket está `resolved` o `closed`, se reabre automáticamente a `waiting_internal`
- El mensaje se guarda como `author_type: 'client'`

---

### 3.6 Actualizar Ticket

```
PATCH /api/public/tickets/:id
```

**Body:**

```json
{
  "client_email": "usuario@implementacion.com",
  "status": "resolved",
  "priority": "low"
}
```

Estados permitidos para el cliente: `open`, `resolved`, `closed`.

---

### 3.7 Subir Archivo

```
POST /api/public/upload
```

**Body:**

```json
{
  "file_data": "base64-del-archivo",
  "file_name": "error.png"
}
```

**Respuesta:**

```json
{
  "ok": true,
  "url": "/public_uploads/1712345678_a1b2c3.png"
}
```

La URL se puede incluir en el mensaje del ticket.

---

## 4. Estados del Ticket

| Estado | Significado |
|--------|-------------|
| `open` | Recién creado, sin asignar |
| `in_progress` | En revisión por soporte |
| `waiting_client` | Esperando respuesta del cliente |
| `waiting_internal` | Esperando acción interna |
| `resolved` | Solucionado (cliente puede reabrir) |
| `closed` | Cerrado definitivamente |
| `cancelled` | Cancelado |

---

## 5. Widget React Portátil

El archivo `SupportWidget.tsx` es un componente React 100% autónomo.
Se copia directo a cualquier proyecto cliente, sin dependencias adicionales.

### Instalación

1. Copiar el archivo `SupportWidget.tsx` a `components/SupportWidget.tsx`
2. Agregar la API token en el `.env`:
   ```env
   VITE_TDP_SUPPORT_TOKEN=token-aqui
   ```
3. Importar y renderizar en el layout principal:
   ```tsx
   import { SupportWidget } from './components/SupportWidget';
   
   function AppLayout() {
     const user = useAuth(); // tu sistema de auth
     return (
       <>
         <YourApp />
         <SupportWidget
           apiToken={import.meta.env.VITE_TDP_SUPPORT_TOKEN}
           clientEmail={user.email}
           clientName={user.fullName || user.email}
           implementationSlug="mi-implementacion"
         />
       </>
     );
   }
   ```

### Props

| Prop | Requerido | Descripción |
|------|-----------|-------------|
| `apiToken` | sí | Token de la API pública |
| `clientEmail` | sí | Email del usuario logueado |
| `clientName` | sí | Nombre del usuario logueado |
| `implementationSlug` | no | Identificador único de la implementación (se muestra en TDP Admin) |

### Comportamiento

- Muestra un botón flotante "?" abajo a la derecha
- Al abrir: lista de tickets del usuario
- Crear nuevo ticket
- Chat en tiempo real (polling cada 10 segundos)
- Interfaz responsive, 380px de ancho

---

## 6. Checklist de Integración

Cada nueva implementación debe:

- [ ] Configurar `VITE_TDP_SUPPORT_TOKEN` en el `.env`
- [ ] Copiar `SupportWidget.tsx` al proyecto
- [ ] Identificar dónde renderizarlo (layout principal)
- [ ] Verificar creación de ticket desde el widget
- [ ] Verificar listado (solo sus tickets)
- [ ] Verificar mensajes (envío y recepción)
- [ ] Verificar que en TDP Admin aparece con la fuente "API" y el slug correcto

---

## 7. Seguridad

- El `x-api-token` identifica la implementación como legítima
- Cada ticket se asocia al `client_email` del usuario que lo crea
- `client_email` es obligatorio en todas las operaciones como llave de seguridad
- Nadie puede ver tickets de otro email
- Las notas internas (`is_internal = true`) nunca se exponen
