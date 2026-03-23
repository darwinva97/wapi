# Despliegue en k3s

Esta guía describe cómo desplegar WAPI específicamente en un cluster k3s.

## ¿Qué es k3s?

k3s es una distribución lightweight de Kubernetes certificada por CNCF, diseñada para:
- Edge computing
- IoT devices
- CI/CD pipelines
- Desarrollo en ARM (Raspberry Pi, etc.)
- Entornos con recursos limitados

k3s incluye por defecto:
- ✅ Traefik como Ingress Controller
- ✅ Local Path Provisioner para volúmenes persistentes
- ✅ CoreDNS
- ✅ Service Load Balancer (Klipper-lb)
- ✅ Network Policy Controller

## Instalación de k3s

### En un solo nodo

```bash
# Instalación básica
curl -sfL https://get.k3s.io | sh -

# Verificar instalación
sudo k3s kubectl get nodes
```

### En múltiples nodos

**Nodo maestro:**
```bash
curl -sfL https://get.k3s.io | sh -s - server --cluster-init

# Obtener token
sudo cat /var/lib/rancher/k3s/server/node-token
```

**Nodos workers:**
```bash
curl -sfL https://get.k3s.io | K3S_URL=https://MASTER_IP:6443 K3S_TOKEN=<TOKEN> sh -
```

### Configurar kubectl

```bash
# Copiar kubeconfig
mkdir ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# Verificar
kubectl get nodes
```

## Despliegue de WAPI en k3s

### 1. Preparar Manifiestos

Los manifiestos en la carpeta `kubernetes/` funcionan directamente con k3s sin modificaciones.

Sin embargo, para aprovechar mejor k3s, ajusta el Ingress:

```yaml
# kubernetes/ingress-k3s.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wapi
  namespace: wapi
  annotations:
    # Configuración para Traefik (incluido en k3s)
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    # Opcional: Redirección automática a HTTPS
    traefik.ingress.kubernetes.io/redirect-entry-point: websecure
    traefik.ingress.kubernetes.io/redirect-permanent: "true"
spec:
  rules:
  - host: wapi.local  # O tu dominio real
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wapi
            port:
              number: 80
  tls:
  - hosts:
    - wapi.local
    secretName: wapi-tls
```

### 2. Storage en k3s

k3s incluye **Local Path Provisioner** por defecto. Los PVCs se crearán automáticamente en:
- `/var/lib/rancher/k3s/storage/`

No necesitas configurar `storageClassName` en `kubernetes/pvc.yaml`, pero si quieres ser explícito:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wapi-whatsapp-sessions
  namespace: wapi
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path  # Storage class por defecto de k3s
  resources:
    requests:
      storage: 5Gi
```

### 3. Desplegar la Aplicación

```bash
# 1. Construir y subir la imagen (puede ser a un registry local)
docker build -t wapi:latest .
docker save wapi:latest | sudo k3s ctr images import -

# 2. Configurar secretos
cp kubernetes/secret.example.yaml kubernetes/secret.yaml
nano kubernetes/secret.yaml

# 3. Ajustar configmap
nano kubernetes/configmap.yaml

# 4. Desplegar
kubectl apply -k kubernetes/

# O aplicar todos los archivos individualmente
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/secret.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/pvc.yaml
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
kubectl apply -f kubernetes/ingress.yaml
```

### 4. Verificar el Despliegue

```bash
# Ver todos los recursos
kubectl get all -n wapi

# Ver volúmenes persistentes
kubectl get pvc -n wapi
kubectl get pv

# Ver logs
kubectl logs -f deployment/wapi -n wapi

# Ver ingress
kubectl get ingress -n wapi
```

### 5. Acceder a la Aplicación

#### Opción A: LoadBalancer (por defecto en k3s)

k3s expone automáticamente los servicios a través de Klipper-lb:

```bash
# Obtener la IP externa
kubectl get svc -n wapi

# Acceder vía IP
curl http://<EXTERNAL-IP>
```

#### Opción B: NodePort

```bash
# Exponer el servicio como NodePort
kubectl patch svc wapi -n wapi -p '{"spec":{"type":"NodePort"}}'

# Obtener el puerto
kubectl get svc wapi -n wapi

# Acceder vía NodePort
curl http://<NODE-IP>:<NODE-PORT>
```

#### Opción C: Port Forward (desarrollo)

```bash
kubectl port-forward -n wapi deployment/wapi 3000:3000

# Acceder en http://localhost:3000
```

#### Opción D: Ingress con DNS local

Para acceso por dominio en tu red local:

1. Agregar entrada en `/etc/hosts`:
```bash
echo "192.168.1.100 wapi.local" | sudo tee -a /etc/hosts
```

2. Acceder en el navegador:
```
http://wapi.local
```

## Configuración Avanzada para k3s

### Usar Registry Local

Para evitar subir imágenes a registries públicos:

```bash
# 1. Crear registry local
docker run -d -p 5000:5000 --restart=always --name registry registry:2

# 2. Construir y subir imagen
docker build -t localhost:5000/wapi:latest .
docker push localhost:5000/wapi:latest

# 3. Configurar k3s para usar registry inseguro
sudo nano /etc/rancher/k3s/registries.yaml
```

Contenido de `registries.yaml`:
```yaml
mirrors:
  localhost:5000:
    endpoint:
      - "http://localhost:5000"
```

```bash
# 4. Reiniciar k3s
sudo systemctl restart k3s
```

### Certificados SSL con cert-manager

```bash
# 1. Instalar cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 2. Crear ClusterIssuer para Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: tu-email@ejemplo.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: traefik
EOF

# 3. Actualizar Ingress con anotación
kubectl annotate ingress wapi -n wapi \
  cert-manager.io/cluster-issuer=letsencrypt-prod
```

### Monitoreo con k3s

```bash
# Ver uso de recursos del nodo
kubectl top nodes

# Ver uso de recursos de pods
kubectl top pods -n wapi

# Ver eventos del sistema
kubectl get events -A --sort-by='.lastTimestamp'
```

### Backups en k3s

```bash
# Backup manual de volúmenes
sudo tar czf wapi-sessions-backup.tar.gz /var/lib/rancher/k3s/storage/pvc-*/

# O usar el script incluido
./deploy.sh backup

# Backup del cluster completo (incluye etcd)
sudo cp -r /var/lib/rancher/k3s/server/db /backup/k3s-db-$(date +%Y%m%d)
```

## Desinstalación

### Desinstalar WAPI

```bash
# Eliminar la aplicación
kubectl delete -k kubernetes/

# Eliminar namespace y todo su contenido
kubectl delete namespace wapi
```

### Desinstalar k3s

```bash
# En el servidor
sudo /usr/local/bin/k3s-uninstall.sh

# En los workers
sudo /usr/local/bin/k3s-agent-uninstall.sh
```

## Solución de Problemas en k3s

### Pod en estado Pending

```bash
# Verificar eventos
kubectl describe pod -n wapi -l app=wapi

# Verificar que hay recursos disponibles
kubectl describe nodes
```

### Problemas con Ingress

```bash
# Verificar que Traefik está corriendo
kubectl get pods -n kube-system | grep traefik

# Ver logs de Traefik
kubectl logs -n kube-system deployment/traefik

# Verificar configuración del Ingress
kubectl describe ingress wapi -n wapi
```

### Problemas con Storage

```bash
# Verificar provisioner
kubectl get storageclass

# Ver estado de PV y PVC
kubectl get pv
kubectl get pvc -n wapi

# Verificar espacio en disco del nodo
df -h /var/lib/rancher/k3s/storage/
```

### Acceso a la Imagen

Si el pod no puede descargar la imagen:

```bash
# Importar imagen localmente
docker save wapi:latest | sudo k3s ctr images import -

# Verificar imágenes disponibles
sudo k3s crictl images
```

## Recursos y Performance

### Requisitos Mínimos

Para ejecutar WAPI en k3s:
- **CPU**: 1 core (mínimo), 2 cores (recomendado)
- **RAM**: 1GB (mínimo), 2GB (recomendado)
- **Disco**: 10GB libres para k3s + 25GB para volúmenes

### Ejemplo: Raspberry Pi

k3s funciona excelente en Raspberry Pi:

```bash
# Raspberry Pi 4 (4GB RAM) - RECOMENDADO
# Raspberry Pi 3 B+ (1GB RAM) - MÍNIMO

# Instalación en ARM64
curl -sfL https://get.k3s.io | sh -

# Ajustar recursos en deployment
kubectl patch deployment wapi -n wapi -p '
spec:
  template:
    spec:
      containers:
      - name: wapi
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
'
```

## Comparación k3s vs k8s

| Característica | k3s | k8s |
|---------------|-----|-----|
| Tamaño binario | ~70MB | ~1GB+ |
| Memoria mínima | 512MB | 2GB+ |
| Instalación | 1 comando | Múltiples pasos |
| Almacenamiento embebido | SQLite | etcd |
| Ingress Controller | Traefik (incluido) | Separado |
| Load Balancer | Klipper (incluido) | Separado |
| Tiempo setup | < 1 min | 10-30 min |

## Recursos Adicionales

- [Documentación oficial de k3s](https://docs.k3s.io/)
- [k3s en GitHub](https://github.com/k3s-io/k3s)
- [Guía completa de Kubernetes](./KUBERNETES.md)
- [Arquitectura del deployment](./KUBERNETES_ARCHITECTURE.md)
