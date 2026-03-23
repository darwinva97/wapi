# Guía Rápida de Despliegue en Kubernetes

Esta guía funciona con cualquier distribución de Kubernetes: **k8s, k3s, minikube, microk8s**, y proveedores cloud (EKS, GKE, AKS).

## Inicio Rápido

### 1. Preparar la Imagen

```bash
# Opción A: Construir y subir manualmente
export IMAGE_NAME=your-registry/wapi
export IMAGE_TAG=v1.0.0

docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
docker push ${IMAGE_NAME}:${IMAGE_TAG}

# Opción B: Usar el script de despliegue
IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0 ./deploy.sh build
IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0 ./deploy.sh push
```

### 2. Configurar Secretos

Edita `kubernetes/secret.yaml`:

```yaml
stringData:
  DATABASE_URL: "libsql://your-database.turso.io"
  DATABASE_AUTH_TOKEN: "your-token"
  BETTER_AUTH_SECRET: "your-secret-min-32-chars"
```

### 3. Configurar Variables de Entorno

Edita `kubernetes/configmap.yaml`:

```yaml
data:
  BETTER_AUTH_URL: "https://tu-dominio.com"
```

### 4. Configurar Ingress

Edita `kubernetes/ingress.yaml`:

```yaml
rules:
- host: tu-dominio.com
```

### 5. Actualizar la Imagen en el Deployment

Edita `kubernetes/deployment.yaml`:

```yaml
image: your-registry/wapi:v1.0.0
```

### 6. Desplegar

```bash
# Opción A: kubectl
kubectl apply -k kubernetes/

# Opción B: Script de despliegue
./deploy.sh deploy

# Opción C: Todo en uno (build, push, deploy)
IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0 ./deploy.sh full
```

### 7. Verificar

```bash
# Ver estado
kubectl get all -n wapi

# Ver logs
kubectl logs -f deployment/wapi -n wapi

# O usar el script
./deploy.sh status
./deploy.sh logs
```

## Desarrollo Local con Docker

```bash
# Copiar variables de entorno
cp env.example .env

# Editar .env con tus credenciales

# Ejecutar en modo producción
docker-compose up

# Ejecutar en modo desarrollo con hot reload
docker-compose --profile dev up wapi-dev
```

## Comandos Útiles del Script

```bash
# Ver ayuda
./deploy.sh help

# Verificar requisitos
./deploy.sh check

# Ver estado
./deploy.sh status

# Ver logs en tiempo real
./deploy.sh logs

# Abrir shell en el pod
./deploy.sh shell

# Actualizar a nueva versión
IMAGE_TAG=v1.1.0 ./deploy.sh update

# Hacer rollback
./deploy.sh rollback

# Crear backup
./deploy.sh backup

# Eliminar todo
./deploy.sh delete
```

## Arquitectura del Despliegue

```
                    Internet
                       |
                       v
                  [Ingress]
                       |
                       v
                  [Service]
                       |
                       v
                   [Pod(s)]
                       |
        +--------------+---------------+
        |                              |
        v                              v
[PVC: WhatsApp Sessions]      [PVC: Media Files]
```

## Consideraciones Importantes

### ⚠️ Réplicas

- **Solo 1 réplica** debido a las sesiones de WhatsApp
- No escalar horizontalmente sin implementar sesión compartida
- Usar `Recreate` strategy para evitar conflictos

### 💾 Volúmenes Persistentes

- **whatsapp_sessions**: 5Gi - Crítico, hacer backup frecuentemente
- **media**: 20Gi - Ajustar según necesidad

### 🔐 Seguridad

- No commitear `secret.yaml` con datos reales
- Usar un gestor de secretos en producción
- Implementar Network Policies
- Usar imagePullSecrets para registros privados

### 📊 Monitoreo

```bash
# Ver uso de recursos
kubectl top pod -n wapi

# Ver eventos
kubectl get events -n wapi --sort-by='.lastTimestamp'

# Probar conectividad
kubectl port-forward -n wapi deployment/wapi 3000:3000
```

## Solución Rápida de Problemas

### Pod no inicia

```bash
kubectl describe pod -n wapi -l app=wapi
kubectl logs -n wapi -l app=wapi
```

### Problemas de imagen

```bash
# Verificar que la imagen existe
docker pull your-registry/wapi:v1.0.0

# Ver secretos de pull de imagen
kubectl get secrets -n wapi
```

### Problemas de volumen

```bash
# Ver PVC
kubectl get pvc -n wapi

# Ver permisos en el pod
kubectl exec -n wapi deployment/wapi -- ls -la /app/whatsapp_sessions
```

### Acceso temporal

```bash
# Port forward para acceso directo
kubectl port-forward -n wapi deployment/wapi 3000:3000
```

## Actualización de la Aplicación

```bash
# 1. Construir nueva versión
IMAGE_TAG=v1.1.0 ./deploy.sh build

# 2. Subir al registro
IMAGE_TAG=v1.1.0 ./deploy.sh push

# 3. Actualizar deployment
IMAGE_TAG=v1.1.0 ./deploy.sh update

# Si algo sale mal, hacer rollback
./deploy.sh rollback
```

## Backups Automáticos

Considera configurar un CronJob para backups automáticos:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: wapi-backup
  namespace: wapi
spec:
  schedule: "0 2 * * *"  # Diario a las 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: your-registry/wapi:latest
            command: ["/bin/sh", "-c"]
            args:
            - |
              tar czf /backup/sessions-$(date +%Y%m%d).tar.gz /app/whatsapp_sessions
              tar czf /backup/media-$(date +%Y%m%d).tar.gz /app/public/media
            volumeMounts:
            - name: whatsapp-sessions
              mountPath: /app/whatsapp_sessions
            - name: media
              mountPath: /app/public/media
            - name: backup
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: whatsapp-sessions
            persistentVolumeClaim:
              claimName: wapi-whatsapp-sessions
          - name: media
            persistentVolumeClaim:
              claimName: wapi-media
          - name: backup
            persistentVolumeClaim:
              claimName: wapi-backup
```

## Más Información

Para detalles completos, ver [KUBERNETES.md](./KUBERNETES.md)
