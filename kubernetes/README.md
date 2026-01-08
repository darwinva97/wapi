# Configuración de Kubernetes para WAPI

Esta carpeta contiene todos los manifiestos necesarios para desplegar WAPI en un cluster de Kubernetes (k8s, k3s, minikube, microk8s, etc.).

## 📁 Archivos

- **namespace.yaml**: Define el namespace `wapi` para aislar los recursos
- **configmap.yaml**: Variables de entorno no sensibles
- **secret.example.yaml**: Plantilla para secretos (copiar a secret.yaml)
- **pvc.yaml**: Persistent Volume Claims para almacenamiento
- **deployment.yaml**: Configuración del deployment de la aplicación
- **service.yaml**: Servicio ClusterIP para acceso interno
- **ingress.yaml**: Configuración del Ingress para acceso externo
- **hpa.yaml**: Horizontal Pod Autoscaler (configurado para 1 réplica)
- **kustomization.yaml**: Configuración de Kustomize

## 🚀 Inicio Rápido

### 1. Configurar Secretos

```bash
# Copiar archivo de ejemplo
cp secret.example.yaml secret.yaml

# Editar con tus credenciales reales
# IMPORTANTE: No commitear secret.yaml (está en .gitignore)
nano secret.yaml
```

### 2. Configurar Variables

Editar archivos según tu entorno:
- `configmap.yaml`: Dominio y variables públicas
- `deployment.yaml`: Imagen de Docker
- `ingress.yaml`: Dominio y configuración SSL

### 3. Desplegar

```bash
# Desde la raíz del proyecto
kubectl apply -k kubernetes/

# O usando el script
./deploy.sh deploy
```

## 📖 Documentación Completa

Ver documentación detallada en:
- [Guía Rápida](../docs/KUBERNETES_QUICKSTART.md)
- [Documentación Completa](../docs/KUBERNETES.md)
- [Checklist de Setup](../KUBERNETES_SETUP_CHECKLIST.md)

## ⚙️ Configuración Personalizada

### Storage Classes

Si tu cluster tiene una storage class específica, edita `pvc.yaml`:

```yaml
spec:
  storageClassName: your-storage-class
```

Ver storage classes disponibles:
```bash
kubectl get storageclass
```

### Ingress Controller

Configura las anotaciones en `ingress.yaml` según tu controlador:

**nginx-ingress:**
```yaml
annotations:
  kubernetes.io/ingress.class: nginx
  cert-manager.io/cluster-issuer: letsencrypt-prod
```

**traefik:**
```yaml
annotations:
  traefik.ingress.kubernetes.io/router.entrypoints: websecure
  traefik.ingress.kubernetes.io/router.tls: "true"
```

### Resources

Ajusta límites en `deployment.yaml` según tu carga:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

## 🔒 Seguridad

### Para Desarrollo
- Usar `secret.yaml` con valores de prueba
- Commitear `secret.example.yaml` como plantilla

### Para Producción
- **Nunca** commitear `secret.yaml` con credenciales reales
- Usar gestores de secretos:
  - [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
  - [External Secrets Operator](https://external-secrets.io/)
  - Servicios cloud (AWS Secrets Manager, GCP Secret Manager, etc.)

## 📝 Notas Importantes

### Réplicas

⚠️ **La aplicación solo soporta 1 réplica** debido a las sesiones de WhatsApp que requieren almacenamiento persistente local.

No aumentes `replicas` en `deployment.yaml` sin implementar primero una solución para compartir el estado de las sesiones.

### Volúmenes Persistentes

Dos volúmenes críticos:
- **whatsapp_sessions** (5Gi): Sesiones de WhatsApp
- **media** (20Gi): Archivos multimedia

**Backup regular es esencial**:
```bash
./deploy.sh backup
```

### Strategy

El deployment usa `Recreate` strategy en lugar de `RollingUpdate` para evitar conflictos con las sesiones de WhatsApp.

## 🛠️ Comandos Útiles

```bash
# Aplicar cambios
kubectl apply -k kubernetes/

# Ver estado
kubectl get all -n wapi

# Ver logs
kubectl logs -f deployment/wapi -n wapi

# Acceder al pod
kubectl exec -it deployment/wapi -n wapi -- /bin/sh

# Port forward para testing
kubectl port-forward -n wapi deployment/wapi 3000:3000

# Ver eventos
kubectl get events -n wapi --sort-by='.lastTimestamp'
```

## 🆘 Solución de Problemas

### Pod no inicia

```bash
kubectl describe pod -n wapi -l app=wapi
kubectl logs -n wapi -l app=wapi
```

### Problemas de almacenamiento

```bash
kubectl get pvc -n wapi
kubectl describe pvc -n wapi
```

### Problemas de red

```bash
kubectl get svc -n wapi
kubectl get endpoints -n wapi
kubectl get ingress -n wapi
```

Ver más en la [documentación completa](../docs/KUBERNETES.md#solución-de-problemas).
