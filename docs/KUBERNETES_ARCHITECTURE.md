# Arquitectura de Despliegue en Kubernetes

## Vista General del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   DNS / CDN     │
                    │  tu-dominio.com │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Ingress Controller                      │ │
│  │              (nginx / traefik / etc.)                     │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │                                      │
│                         ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Ingress Resource                       │ │
│  │                  (wapi.namespace)                         │ │
│  │               Routes: your-domain.com                     │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │                                      │
│                         ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Service (ClusterIP)                     │ │
│  │                    Port: 80 → 3000                        │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │                                      │
│                         ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                      Deployment                           │ │
│  │                    Replicas: 1                            │ │
│  │                 Strategy: Recreate                        │ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │                    Pod: wapi                        │  │ │
│  │  │                                                     │  │ │
│  │  │  ┌──────────────────────────────────────────────┐  │  │ │
│  │  │  │         Container: wapi                      │  │  │ │
│  │  │  │    Image: your-registry/wapi:latest          │  │  │ │
│  │  │  │    Port: 3000                                │  │  │ │
│  │  │  │                                              │  │  │ │
│  │  │  │  Environment Variables:                     │  │  │ │
│  │  │  │  ├─ ConfigMap: wapi-config                  │  │  │ │
│  │  │  │  │  ├─ NODE_ENV                             │  │  │ │
│  │  │  │  │  ├─ BETTER_AUTH_URL                      │  │  │ │
│  │  │  │  │  └─ ...                                  │  │  │ │
│  │  │  │  │                                           │  │  │ │
│  │  │  │  └─ Secret: wapi-secrets                    │  │  │ │
│  │  │  │     ├─ DATABASE_URL                         │  │  │ │
│  │  │  │     ├─ DATABASE_AUTH_TOKEN                  │  │  │ │
│  │  │  │     └─ BETTER_AUTH_SECRET                   │  │  │ │
│  │  │  │                                              │  │  │ │
│  │  │  │  Volume Mounts:                             │  │  │ │
│  │  │  │  ├─ /app/whatsapp_sessions                  │  │  │ │
│  │  │  │  └─ /app/public/media                       │  │  │ │
│  │  │  │                                              │  │  │ │
│  │  │  │  Resource Limits:                           │  │  │ │
│  │  │  │  ├─ CPU: 250m - 1000m                       │  │  │ │
│  │  │  │  └─ Memory: 512Mi - 2Gi                     │  │  │ │
│  │  │  │                                              │  │  │ │
│  │  │  │  Health Checks:                             │  │  │ │
│  │  │  │  ├─ Liveness Probe  (HTTP GET /)            │  │  │ │
│  │  │  │  └─ Readiness Probe (HTTP GET /)            │  │  │ │
│  │  │  └──────────────────────────────────────────────┘  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                         │                 │                │ │
│  │                         ▼                 ▼                │ │
│  │              ┌──────────────────┬──────────────────┐      │ │
│  │              │                  │                  │      │ │
│  │              ▼                  ▼                  │      │ │
│  │  ┌───────────────────┐ ┌──────────────────┐       │      │ │
│  │  │       PVC:        │ │      PVC:        │       │      │ │
│  │  │  whatsapp-sessions│ │      media       │       │      │ │
│  │  │      (5Gi)        │ │     (20Gi)       │       │      │ │
│  │  └─────────┬─────────┘ └────────┬─────────┘       │      │ │
│  │            │                    │                  │      │ │
│  │            ▼                    ▼                  │      │ │
│  │  ┌───────────────────┐ ┌──────────────────┐       │      │ │
│  │  │  Persistent       │ │   Persistent     │       │      │ │
│  │  │  Volume (PV)      │ │   Volume (PV)    │       │      │ │
│  │  └───────────────────┘ └──────────────────┘       │      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │        HorizontalPodAutoscaler (HPA)                     │ │
│  │          Min: 1, Max: 1 (No scaling)                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### Tráfico Entrante (Requests)
```
Usuario → DNS → Ingress Controller → Ingress Resource → Service → Pod → Aplicación Next.js
```

### Almacenamiento Persistente
```
Aplicación Next.js → Volume Mount → PVC → PV → Storage Backend
```

### Configuración
```
Pod → Environment Variables → ConfigMap (públicas) + Secrets (sensibles)
```

## Componentes Clave

### 1. Namespace: `wapi`
- Aísla todos los recursos de la aplicación
- Facilita la gestión y el RBAC

### 2. ConfigMap: `wapi-config`
- Variables de entorno no sensibles
- Fácilmente actualizable sin rebuild
- Ejemplos: NODE_ENV, BETTER_AUTH_URL

### 3. Secret: `wapi-secrets`
- Credenciales y datos sensibles
- Base64 encoded
- Ejemplos: DATABASE_URL, AUTH_SECRET

### 4. PersistentVolumeClaim (PVC)
**whatsapp-sessions (5Gi)**
- Almacena las sesiones de WhatsApp
- Crítico - contiene las credenciales de autenticación
- Backup frecuente recomendado

**media (20Gi)**
- Almacena archivos multimedia
- Imágenes, videos, documentos recibidos
- Tamaño ajustable según necesidad

### 5. Deployment
- **Replicas**: 1 (no escalar debido a sesiones de WhatsApp)
- **Strategy**: Recreate (evita conflictos de sesión)
- **Image**: Next.js standalone build
- **Health Checks**: Liveness + Readiness probes

### 6. Service
- Tipo: ClusterIP (interno al cluster)
- Expone el pod en el puerto 80
- Redirige al puerto 3000 del container

### 7. Ingress
- Punto de entrada externo
- Maneja routing por dominio
- Soporte TLS/SSL opcional
- Integración con cert-manager

### 8. HorizontalPodAutoscaler (HPA)
- Configurado con min=1, max=1
- Previene escalado automático
- Necesario por limitaciones de sesiones de WhatsApp

## Seguridad

### Network Policies (Opcional)
```
Internet → Ingress Controller → wapi Pod → External Services (Database, APIs)
         ✓ Permitido         ✓ Permitido    ✓ Permitido

wapi Pod → Otros Namespaces
         ✗ Bloqueado (configurable)
```

### Pod Security
- Usuario no-root (nextjs:1001)
- Read-only filesystem (excepto volúmenes)
- No privilegios escalados
- Capabilities mínimos

## Backup y Recuperación

### Estrategia de Backup
```
┌─────────────────────────────────────────────────────────────┐
│                    Backup Strategy                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Daily:                                                     │
│  ├─ WhatsApp Sessions → Cloud Storage / NAS               │
│  └─ Media Files → Cloud Storage / NAS                      │
│                                                             │
│  Before Updates:                                            │
│  ├─ Complete snapshot de PVs                               │
│  └─ Export de configuraciones                              │
│                                                             │
│  Methods:                                                   │
│  ├─ CronJob en Kubernetes                                  │
│  ├─ Velero (cluster backup)                                │
│  └─ Manual: ./deploy.sh backup                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Monitoreo y Observabilidad

### Logs
```bash
# En tiempo real
kubectl logs -f deployment/wapi -n wapi

# Últimas 100 líneas
kubectl logs --tail=100 deployment/wapi -n wapi

# Desde hace 1 hora
kubectl logs --since=1h deployment/wapi -n wapi
```

### Métricas
```bash
# CPU y Memoria
kubectl top pod -n wapi

# Eventos
kubectl get events -n wapi --sort-by='.lastTimestamp'
```

### Health Status
```bash
# Estado general
kubectl get all -n wapi

# Detalles del pod
kubectl describe pod -n wapi -l app=wapi
```

## Escalabilidad

### Limitaciones Actuales
⚠️ **1 Réplica Máxima**
- WhatsApp sessions no son compartibles
- Storage PV no soporta ReadWriteMany
- Estado de sesión es local al pod

### Futuras Mejoras para Escalabilidad
1. **Session Storage Distribuido**
   - Redis/Memcached para sesiones
   - Database compartida para estado
   
2. **Sticky Sessions**
   - Session affinity en el Ingress
   - Routing basado en cuenta de WhatsApp
   
3. **Storage Class con RWX**
   - NFS o similar para múltiples pods
   - EFS (AWS), Filestore (GCP), Azure Files

## Costos Estimados

### Recursos Mínimos
- **1 Pod**: ~512Mi RAM, 0.25 CPU
- **Storage**: 25Gi (5Gi sessions + 20Gi media)
- **Ingress**: Varía según proveedor

### Ejemplo en Cloud Providers

**AWS EKS:**
- Node: t3.small ($0.0208/hr) = ~$15/mes
- EBS Volume: 25GB ($0.10/GB) = ~$2.5/mes
- ALB: ~$16/mes
- **Total**: ~$33-35/mes

**Google GKE:**
- Node: e2-small ($0.021/hr) = ~$15/mes
- PD Storage: 25GB ($0.17/GB) = ~$4.25/mes
- Ingress: Incluido
- **Total**: ~$19-20/mes

**DigitalOcean:**
- Node: Basic ($12/mes)
- Volume: 25GB ($2.50/mes)
- Load Balancer: $10/mes
- **Total**: ~$24-25/mes

*Nota: Costos aproximados, verificar precios actuales*

## CI/CD Pipeline Sugerido

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Git Push  │ -> │  Build Image │ -> │ Push to ECR │ -> │ Update K8s   │
│  to main    │    │  (Docker)    │    │ / GCR / etc │    │  Deployment  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │                                       │
                           ▼                                       ▼
                   ┌──────────────┐                      ┌──────────────┐
                   │  Run Tests   │                      │  Health Check│
                   │  Lint, Unit  │                      │  Smoke Tests │
                   └──────────────┘                      └──────────────┘
                           │                                       │
                           ▼                                       ▼
                   ┌──────────────┐                      ┌──────────────┐
                   │  Security    │                      │  Rollback if │
                   │  Scan Image  │                      │  Failure     │
                   └──────────────┘                      └──────────────┘
```

## Documentación Relacionada

- [Guía Rápida](KUBERNETES_QUICKSTART.md)
- [Documentación Completa](KUBERNETES.md)
- [Checklist de Setup](../KUBERNETES_SETUP_CHECKLIST.md)
- [README Principal](../README.md)
