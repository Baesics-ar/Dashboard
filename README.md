# Studio Pro v2 — Gestión de Producción Textil

Dashboard colaborativo con persistencia real en PostgreSQL. Los datos persisten entre sesiones, recargas y entre distintos usuarios.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite 5 |
| Charts | Recharts |
| Backend | Node 18+ + Express |
| Base de datos | PostgreSQL |
| Deploy | Railway |

---

## Estructura

```
studiopro/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.js        # Conexión PG + migraciones automáticas
│   │   │   └── queries.js     # CRUD completo
│   │   ├── middleware/
│   │   │   └── validate.js    # Validación de requests
│   │   ├── routes/
│   │   │   └── productions.js # REST API
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api.js             # Cliente HTTP centralizado
│   │   ├── main.jsx
│   │   └── App.jsx            # App completa (sin datos mock)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── .gitignore
├── package.json
├── railway.json
└── README.md
```

---

## API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/productions | Listar todas |
| GET | /api/productions/:id | Obtener una |
| POST | /api/productions | Crear nueva |
| PUT | /api/productions/:id | Actualizar completa |
| PATCH | /api/productions/:id/stage | Cambiar estado |
| PATCH | /api/productions/:id/tasks | Actualizar checklist |
| DELETE | /api/productions/:id | Eliminar |

---

## Correr localmente

### Requisitos
- Node >= 18
- PostgreSQL local (o Docker)

### Con Docker Postgres (más rápido)

```bash
docker run --name studiopro-db \
  -e POSTGRES_USER=studiopro \
  -e POSTGRES_PASSWORD=studiopro \
  -e POSTGRES_DB=studiopro \
  -p 5432:5432 -d postgres:16
```

### Instalación

```bash
git clone https://github.com/TU_USUARIO/studiopro.git
cd studiopro

npm run install:all

cp .env.example .env
# Editar .env con tu DATABASE_URL local

npm run dev
```

- **Frontend** → http://localhost:5173
- **Backend** → http://localhost:3001
- **Health** → http://localhost:3001/health

> Las tablas se crean automáticamente en el primer arranque (migración automática).

---

## Deploy en Railway

### 1. Agregar PostgreSQL

En Railway → tu proyecto → **+ New** → **Database** → **PostgreSQL**

Railway inyecta `DATABASE_URL` automáticamente en el servicio.

### 2. Configurar variables de entorno

En el servicio de la app → **Variables**:

```
NODE_ENV=production
```

> `PORT` y `DATABASE_URL` los inyecta Railway automáticamente. No los toques.

### 3. Deploy desde GitHub

1. Push el repo a GitHub
2. Railway → **New Project** → **Deploy from GitHub repo**
3. Seleccionar el repo
4. Railway detecta `railway.json` y ejecuta:
   - Build: `npm run install:all && npm run build`
   - Start: `npm run start`
   - Healthcheck: `GET /health`

### Flujo completo de deploy

```bash
# En tu máquina
git init
git add .
git commit -m "feat: v2 with PostgreSQL persistence"
git remote add origin https://github.com/TU_USUARIO/studiopro.git
git branch -M main
git push -u origin main
# Luego conectar en Railway
```

---

## Notas

- **Migración automática**: Las tablas se crean solas en el primer boot. No hay que correr nada manualmente.
- **Colaborativo**: Múltiples usuarios comparten los mismos datos en tiempo real (vía recarga o navegación).
- **Cascada**: Al eliminar una producción, se eliminan sus modelos y variantes automáticamente (FK CASCADE).
