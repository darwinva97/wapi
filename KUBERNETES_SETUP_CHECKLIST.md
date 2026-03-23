# Checklist de Configuración para Kubernetes

Antes de desplegar en Kubernetes, asegúrate de completar los siguientes pasos:

**Compatible con:** k8s, k3s, minikube, microk8s, EKS, GKE, AKS y cualquier cluster Kubernetes 1.19+

## ✅ Pre-despliegue

### 1. Construcción de Imagen

- [ ] Construir la imagen Docker: `make docker-build IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0`
- [ ] Subir la imagen al registro: `make docker-push IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0`
- [ ] Verificar que la imagen está disponible: `docker pull your-registry/wapi:v1.0.0`

### 2. Configuración de Secretos

- [ ] Copiar archivo de ejemplo: `cp kubernetes/secret.example.yaml kubernetes/secret.yaml`
- [ ] Editar `kubernetes/secret.yaml` con credenciales reales:
  - [ ] `DATABASE_URL`: URL de tu base de datos Turso
  - [ ] `DATABASE_AUTH_TOKEN`: Token de autenticación de Turso
  - [ ] `BETTER_AUTH_SECRET`: Secreto mínimo de 32 caracteres
- [ ] **IMPORTANTE**: Verificar que `kubernetes/secret.yaml` está en `.gitignore`

### 3. Configuración de Variables de Entorno

- [ ] Editar `kubernetes/configmap.yaml`:
  - [ ] `BETTER_AUTH_URL`: Tu dominio público (ej: https://wapi.tudominio.com)
  - [ ] Ajustar otras variables según necesidad

### 4. Configuración del Deployment

- [ ] Editar `kubernetes/deployment.yaml`:
  - [ ] Actualizar `image:` con tu imagen real
  - [ ] Ajustar `resources` según tus necesidades
  - [ ] Configurar `imagePullSecrets` si usas registro privado

### 5. Configuración del Ingress

- [ ] Editar `kubernetes/ingress.yaml`:
  - [ ] Cambiar `host:` con tu dominio real
  - [ ] Descomentar y configurar sección `tls` si usas HTTPS
  - [ ] Configurar anotaciones según tu Ingress Controller (nginx, traefik, etc.)

### 6. Configuración de Almacenamiento

- [ ] Editar `kubernetes/pvc.yaml` (opcional):
  - [ ] Ajustar tamaño de volúmenes según necesidad
  - [ ] Configurar `storageClassName` si tienes una clase específica
  - [ ] Verificar que tu cluster tiene un provisioner de volúmenes

### 7. Verificaciones del Cluster

- [ ] Verificar acceso al cluster: `kubectl cluster-info`
- [ ] Verificar storage classes disponibles: `kubectl get storageclass`
- [ ] Verificar que tienes Ingress Controller: `kubectl get ingressclass`

## 🚀 Despliegue

Una vez completado el checklist:

```bash
# Opción 1: Todo automatizado
make k8s-full IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0

# Opción 2: Paso a paso
make k8s-deploy
```

## 🔍 Post-despliegue

- [ ] Verificar pods: `make k8s-status`
- [ ] Revisar logs: `make k8s-logs`
- [ ] Verificar PVC: `kubectl get pvc -n wapi`
- [ ] Probar acceso: `kubectl port-forward -n wapi deployment/wapi 3000:3000`
- [ ] Verificar Ingress: `kubectl get ingress -n wapi`
- [ ] Probar acceso desde el dominio configurado

## 🔒 Seguridad (Producción)

- [ ] Implementar gestión de secretos (Sealed Secrets, External Secrets Operator)
- [ ] Configurar Network Policies
- [ ] Implementar Pod Security Standards
- [ ] Configurar RBAC apropiado
- [ ] Habilitar TLS/SSL en Ingress
- [ ] Configurar backups automáticos
- [ ] Implementar monitoreo y alertas

## 📋 Comandos Útiles

```bash
# Ver ayuda de todos los comandos
make help

# Verificar requisitos
make k8s-check

# Ver estado completo
make k8s-status

# Acceder al shell del pod
make k8s-shell

# Crear backup
make k8s-backup

# Rollback si hay problemas
make k8s-rollback
```

## 🆘 Troubleshooting

Si encuentras problemas, revisa:

1. **Logs del pod**: `make k8s-logs`
2. **Descripción del pod**: `kubectl describe pod -n wapi -l app=wapi`
3. **Eventos del namespace**: `kubectl get events -n wapi --sort-by='.lastTimestamp'`
4. **Estado de PVC**: `kubectl get pvc -n wapi`
5. **Documentación completa**: [docs/KUBERNETES.md](./docs/KUBERNETES.md)

## 📚 Documentación

- [Guía Rápida](docs/KUBERNETES_QUICKSTART.md)
- [Documentación Completa](docs/KUBERNETES.md)
- [README Principal](README.md)
