#!/bin/bash

# Script de ayuda para despliegue de WAPI en Kubernetes
# Uso: ./deploy.sh [comando]

set -e

NAMESPACE="wapi"
IMAGE_NAME="${IMAGE_NAME:-your-registry/wapi}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

function print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

function check_requirements() {
    print_info "Verificando requisitos..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl no está instalado"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "docker no está instalado"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "No se puede conectar al cluster de Kubernetes"
        exit 1
    fi
    
    print_info "Todos los requisitos cumplidos ✓"
}

function build_image() {
    print_info "Construyendo imagen Docker..."
    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
    print_info "Imagen construida: ${IMAGE_NAME}:${IMAGE_TAG}"
}

function push_image() {
    print_info "Subiendo imagen al registro..."
    docker push ${IMAGE_NAME}:${IMAGE_TAG}
    print_info "Imagen subida: ${IMAGE_NAME}:${IMAGE_TAG}"
}

function deploy() {
    print_info "Desplegando en Kubernetes..."
    
    # Verificar si el namespace existe
    if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
        print_info "Creando namespace ${NAMESPACE}..."
        kubectl apply -f kubernetes/namespace.yaml
    fi
    
    # Aplicar manifiestos
    print_info "Aplicando manifiestos..."
    kubectl apply -k kubernetes/
    
    print_info "Esperando a que el deployment esté listo..."
    kubectl rollout status deployment/wapi -n ${NAMESPACE}
    
    print_info "Despliegue completado ✓"
}

function status() {
    print_info "Estado de los recursos en ${NAMESPACE}:"
    echo ""
    kubectl get all -n ${NAMESPACE}
    echo ""
    print_info "Persistent Volume Claims:"
    kubectl get pvc -n ${NAMESPACE}
    echo ""
    print_info "Ingress:"
    kubectl get ingress -n ${NAMESPACE}
}

function logs() {
    print_info "Mostrando logs..."
    kubectl logs -f deployment/wapi -n ${NAMESPACE}
}

function shell() {
    print_info "Abriendo shell en el pod..."
    POD=$(kubectl get pod -n ${NAMESPACE} -l app=wapi -o jsonpath="{.items[0].metadata.name}")
    kubectl exec -it ${POD} -n ${NAMESPACE} -- /bin/sh
}

function delete() {
    print_warning "¿Estás seguro de que quieres eliminar la aplicación? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_info "Eliminando aplicación..."
        kubectl delete -k kubernetes/
        
        print_warning "¿Quieres eliminar también los volúmenes persistentes? (y/N)"
        read -r response2
        if [[ "$response2" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            kubectl delete pvc --all -n ${NAMESPACE}
            print_info "Volúmenes eliminados"
        fi
        
        print_info "Aplicación eliminada"
    else
        print_info "Operación cancelada"
    fi
}

function update() {
    print_info "Actualizando deployment..."
    kubectl set image deployment/wapi wapi=${IMAGE_NAME}:${IMAGE_TAG} -n ${NAMESPACE}
    kubectl rollout status deployment/wapi -n ${NAMESPACE}
    print_info "Actualización completada ✓"
}

function rollback() {
    print_info "Historial de despliegues:"
    kubectl rollout history deployment/wapi -n ${NAMESPACE}
    echo ""
    print_warning "Haciendo rollback al despliegue anterior..."
    kubectl rollout undo deployment/wapi -n ${NAMESPACE}
    kubectl rollout status deployment/wapi -n ${NAMESPACE}
    print_info "Rollback completado ✓"
}

function backup() {
    print_info "Creando backup de volúmenes..."
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p ${BACKUP_DIR}
    
    POD=$(kubectl get pod -n ${NAMESPACE} -l app=wapi -o jsonpath="{.items[0].metadata.name}")
    
    print_info "Backup de sesiones de WhatsApp..."
    kubectl exec -n ${NAMESPACE} ${POD} -- tar czf - /app/whatsapp_sessions > ${BACKUP_DIR}/whatsapp-sessions.tar.gz
    
    print_info "Backup de archivos media..."
    kubectl exec -n ${NAMESPACE} ${POD} -- tar czf - /app/public/media > ${BACKUP_DIR}/media.tar.gz
    
    print_info "Backup completado en: ${BACKUP_DIR}"
}

function help() {
    cat << EOF
Script de despliegue de WAPI en Kubernetes

Uso: ./deploy.sh [comando]

Comandos disponibles:
  check       - Verificar requisitos previos
  build       - Construir imagen Docker
  push        - Subir imagen al registro
  deploy      - Desplegar en Kubernetes
  status      - Ver estado de los recursos
  logs        - Ver logs de la aplicación
  shell       - Abrir shell en el pod
  update      - Actualizar deployment con nueva imagen
  rollback    - Hacer rollback al despliegue anterior
  backup      - Crear backup de volúmenes persistentes
  delete      - Eliminar la aplicación
  full        - Construir, subir y desplegar (build + push + deploy)
  help        - Mostrar esta ayuda

Variables de entorno:
  IMAGE_NAME  - Nombre de la imagen (default: your-registry/wapi)
  IMAGE_TAG   - Tag de la imagen (default: latest)

Ejemplos:
  IMAGE_NAME=myregistry/wapi IMAGE_TAG=v1.0.0 ./deploy.sh build
  ./deploy.sh full
  ./deploy.sh status
  ./deploy.sh logs
EOF
}

# Main
case "$1" in
    check)
        check_requirements
        ;;
    build)
        check_requirements
        build_image
        ;;
    push)
        check_requirements
        push_image
        ;;
    deploy)
        check_requirements
        deploy
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    shell)
        shell
        ;;
    update)
        update
        ;;
    rollback)
        rollback
        ;;
    backup)
        backup
        ;;
    delete)
        delete
        ;;
    full)
        check_requirements
        build_image
        push_image
        deploy
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_error "Comando desconocido: $1"
        echo ""
        help
        exit 1
        ;;
esac
