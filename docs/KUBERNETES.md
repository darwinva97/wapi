# Despliegue en Kubernetes

Este documento describe cómo desplegar la aplicación WAPI en un cluster de Kubernetes.

**Compatible con todas las distribuciones de Kubernetes:**
- ✅ Kubernetes (k8s) estándar
- ✅ k3s (lightweight Kubernetes)
- ✅ minikube (desarrollo local)
- ✅ microk8s (Ubuntu)
- ✅ EKS (AWS), GKE (Google Cloud), AKS (Azure)
- ✅ Cualquier cluster compatible con Kubernetes 1.19+

## Requisitos Previos

- Cluster de Kubernetes funcionando (1.19+)
- `kubectl` configurado para acceder a tu cluster
- Docker instalado para construir la imagen
- Acceso a un registro de imágenes (Docker Hub, Google Container Registry, etc.)
- Ingress Controller instalado (nginx-ingress, traefik, etc.)
- (Opcional) cert-manager para certificados SSL automáticos

## Estructura de Archivos

```
kubernetes/
├── namespace.yaml          # Namespace para la aplicación
├── configmap.yaml          # Variables de entorno no sensibles
├── secret.yaml             # Credenciales y secretos
├── pvc.yaml                # Persistent Volume Claims para almacenamiento
├── deployment.yaml         # Despliegue de la aplicación
├── service.yaml            # Servicio interno
├── ingress.yaml            # Ingress para exposición externa
├── hpa.yaml                # Horizontal Pod Autoscaler
└── kustomization.yaml      # Configuración de Kustomize
```

## Pasos de Despliegue

### 1. Construir la Imagen Docker

```bash
# Construir la imagen
docker build -t your-registry/wapi:latest .

# Subir la imagen al registro
docker push your-registry/wapi:latest
```

### 2. Configurar Secretos y Variables

Edita `kubernetes/secret.yaml` con tus credenciales reales:

```yaml
stringData:
  DATABASE_URL: "libsql://your-actual-database.turso.io"
  DATABASE_AUTH_TOKEN: "your-actual-turso-auth-token"
  BETTER_AUTH_SECRET: "your-actual-secret-minimum-32-chars"
```

**⚠️ IMPORTANTE:** No commitees el archivo `secret.yaml` con credenciales reales a tu repositorio.

Para producción, considera usar:
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [External Secrets Operator](https://external-secrets.io/)
- Servicios de gestión de secretos de tu proveedor cloud (AWS Secrets Manager, GCP Secret Manager, etc.)

Edita `kubernetes/configmap.yaml` con tu dominio:

```yaml
data:
  BETTER_AUTH_URL: "https://your-actual-domain.com"
```

### 3. Actualizar la Imagen en el Deployment

Edita `kubernetes/deployment.yaml` y reemplaza:

```yaml
image: your-registry/wapi:latest
```

Con la referencia real de tu imagen.

### 4. Configurar el Ingress

Edita `kubernetes/ingress.yaml` con tu dominio:

```yaml
rules:
- host: your-actual-domain.com
  http:
    paths:
    - path: /
      pathType: Prefix
      backend:
        service:
          name: wapi
          port:
            number: 80
```

Si usas SSL/TLS, descomenta la sección `tls`:

```yaml
tls:
- hosts:
  - your-actual-domain.com
  secretName: wapi-tls
```

### 5. Desplegar en Kubernetes

#### Opción A: Usando kubectl apply

```bash
# Aplicar todos los manifiestos
kubectl apply -f kubernetes/

# Verificar el despliegue
kubectl get all -n wapi
```

#### Opción B: Usando Kustomize

```bash
# Aplicar usando kustomize
kubectl apply -k kubernetes/

# Verificar el despliegue
kubectl get all -n wapi
```

### 6. Configuración Específica por Distribución

#### k3s

k3s viene con Traefik como Ingress Controller por defecto. Ajusta el Ingress:

```yaml
# kubernetes/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wapi
  namespace: wapi
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  # ... resto de la configuración
```

k3s también incluye un provisioner de volúmenes local por defecto, así que los PVCs funcionarán sin configuración adicional.

#### minikube

Para minikube, habilita el addon de ingress:

```bash
minikube addons enable ingress
minikube addons enable storage-provisioner
```

#### microk8s

Para microk8s, habilita los addons necesarios:

```bash
microk8s enable dns
microk8s enable storage
microk8s enable ingress
```

Usa `microk8s kubectl` en lugar de `kubectl`:

```bash
microk8s kubectl apply -k kubernetes/
```

#### Cloud Providers (EKS, GKE, AKS)

Para proveedores cloud, configura el `storageClassName` en `kubernetes/pvc.yaml`:

```yaml
# AWS EKS
storageClassName: gp3  # o gp2

# Google GKE
storageClassName: standard-rwo

# Azure AKS
storageClassName: managed-premium
```

### 7. Verificar el Despliegue

```bash
# Verificar los pods
kubectl get pods -n wapi

# Ver los logs
kubectl logs -f deployment/wapi -n wapi

# Verificar el servicio
kubectl get svc -n wapi

# Verificar el ingress
kubectl get ingress -n wapi

# Describir el pod para más detalles
kubectl describe pod <pod-name> -n wapi
```

## Gestión de Almacenamiento

La aplicación utiliza dos Persistent Volume Claims:

1. **wapi-whatsapp-sessions** (5Gi): Almacena las sesiones de WhatsApp
2. **wapi-media** (20Gi): Almacena los archivos multimedia

### Configurar Storage Class

Si tu cluster tiene una storage class específica, edita `kubernetes/pvc.yaml`:

```yaml
spec:
  storageClassName: your-storage-class
```

Para ver las storage classes disponibles:

```bash
kubectl get storageclass
```

### Backup de Datos

Es crítico hacer backup regular de los volúmenes persistentes:

```bash
# Crear un backup del volumen de sesiones de WhatsApp
kubectl exec -n wapi deployment/wapi -- tar czf - /app/whatsapp_sessions > whatsapp-sessions-backup.tar.gz

# Crear un backup del volumen de media
kubectl exec -n wapi deployment/wapi -- tar czf - /app/public/media > media-backup.tar.gz
```

## Escalabilidad

⚠️ **IMPORTANTE:** Esta aplicación está configurada para ejecutarse en **1 sola réplica**.

Las sesiones de WhatsApp requieren almacenamiento persistente y no pueden compartirse entre múltiples pods. El deployment está configurado con:

- `replicas: 1`
- `strategy: Recreate`
- HPA con `maxReplicas: 1`

**No aumentes el número de réplicas** sin implementar primero una solución para compartir el estado de las sesiones de WhatsApp.

## Monitoreo y Logs

### Ver logs en tiempo real

```bash
kubectl logs -f deployment/wapi -n wapi
```

### Ver eventos del namespace

```bash
kubectl get events -n wapi --sort-by='.lastTimestamp'
```

### Ver métricas de recursos

```bash
kubectl top pod -n wapi
```

## Actualización de la Aplicación

### Rolling Update

```bash
# Construir y subir nueva imagen
docker build -t your-registry/wapi:v1.1.0 .
docker push your-registry/wapi:v1.1.0

# Actualizar el deployment
kubectl set image deployment/wapi wapi=your-registry/wapi:v1.1.0 -n wapi

# Verificar el rollout
kubectl rollout status deployment/wapi -n wapi
```

### Rollback

Si algo sale mal:

```bash
# Ver historial de despliegues
kubectl rollout history deployment/wapi -n wapi

# Hacer rollback al despliegue anterior
kubectl rollout undo deployment/wapi -n wapi

# Hacer rollback a una revisión específica
kubectl rollout undo deployment/wapi --to-revision=2 -n wapi
```

## Solución de Problemas

### Pod no inicia

```bash
# Ver detalles del pod
kubectl describe pod <pod-name> -n wapi

# Ver logs del pod
kubectl logs <pod-name> -n wapi

# Ver eventos
kubectl get events -n wapi
```

### Problemas de almacenamiento

```bash
# Ver estado de los PVC
kubectl get pvc -n wapi

# Verificar permisos
kubectl exec -it <pod-name> -n wapi -- ls -la /app/whatsapp_sessions
kubectl exec -it <pod-name> -n wapi -- ls -la /app/public/media
```

### Problemas de red

```bash
# Verificar el servicio
kubectl get svc wapi -n wapi

# Verificar endpoints
kubectl get endpoints wapi -n wapi

# Probar conectividad desde otro pod
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://wapi.wapi.svc.cluster.local
```

### Acceso a la aplicación

```bash
# Port forward temporal para acceso directo
kubectl port-forward -n wapi deployment/wapi 3000:3000

# Luego accede a http://localhost:3000
```

## Limpieza

Para eliminar completamente la aplicación:

```bash
# Eliminar todos los recursos
kubectl delete -f kubernetes/

# O con kustomize
kubectl delete -k kubernetes/

# Nota: Los PVC no se eliminan automáticamente por seguridad
# Para eliminarlos también:
kubectl delete pvc --all -n wapi

# Eliminar el namespace
kubectl delete namespace wapi
```

## Configuración Avanzada

### SSL/TLS con cert-manager

Si tienes cert-manager instalado:

1. Crea un ClusterIssuer:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

2. Añade anotaciones al Ingress:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

### Resource Limits

Ajusta los límites de recursos según tu carga:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### Health Checks

Los health checks están configurados en el deployment:

- **Liveness Probe**: Verifica que la aplicación responda
- **Readiness Probe**: Verifica que la aplicación esté lista para recibir tráfico

Ajústalos según tus necesidades en `k8s/deployment.yaml`.

## Seguridad

### Mejores Prácticas

1. **No usar `:latest` en producción**: Usa tags específicos de versión
2. **Usar imagePullSecrets** para registros privados
3. **Implementar Network Policies** para limitar el tráfico
4. **Usar RBAC** para control de acceso
5. **Mantener los secretos fuera del código**
6. **Implementar Pod Security Policies/Standards**
7. **Escanear imágenes** en busca de vulnerabilidades
8. **Actualizar dependencias** regularmente

### Network Policy Ejemplo

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: wapi-network-policy
  namespace: wapi
spec:
  podSelector:
    matchLabels:
      app: wapi
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

## Soporte

Para más información sobre los componentes utilizados:

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
