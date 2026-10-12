# ==============================================================================
# CYBERGURU - Dockerfile Multi-Etapa Ultraligero
# ==============================================================================

# ------------------------------------------------------------------------------
# ETAPA 1: Construcción de la SPA Frontend (React + Vite)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# ETAPA 2: Compilación del Backend en Go
# ------------------------------------------------------------------------------
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app

# Descarga de módulos Go
COPY backend/go.mod backend/go.sum* ./
RUN go mod download || true

# Copia del código fuente y assets para embeber
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/api/dist

# Compilación de binario estático y optimizado (-s -w elimina símbolos de debug)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o cyberguru .

# ------------------------------------------------------------------------------
# ETAPA 3: Imagen Final de Producción (Alpine Linux)
# ------------------------------------------------------------------------------
FROM alpine:3.20

# Paquetes esenciales para operaciones de red física y Bluetooth
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    sqlite-libs \
    iproute2 \
    net-tools \
    bluez \
    libpcap

WORKDIR /app

# Crear directorio de datos persistente para SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Copiar artefactos finales de las etapas previas
COPY --from=backend-builder /app/cyberguru /app/cyberguru
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Configuración por variables de entorno
ENV PORT=8080
ENV DB_PATH=/app/data/cyberguru.db
ENV FRONTEND_DIR=/app/frontend/dist

# Exposición informativa del puerto web
EXPOSE 8080

# Ejecutable principal
ENTRYPOINT ["/app/cyberguru"]
