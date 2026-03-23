.PHONY: help dev build start install db-push db-seed docker-build docker-up k8s-deploy k8s-status k8s-logs

# Variables
IMAGE_NAME ?= your-registry/wapi
IMAGE_TAG ?= latest

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Instalar dependencias
	pnpm install

dev: ## Iniciar servidor de desarrollo
	pnpm dev

build: ## Construir para producción
	pnpm build

start: ## Iniciar servidor de producción
	pnpm start

db-push: ## Aplicar cambios del esquema a la base de datos
	pnpm db:push

db-seed: ## Poblar la base de datos con datos iniciales
	pnpm db:seed

db-studio: ## Abrir Drizzle Studio
	pnpm db:studio

# Docker commands
docker-build: ## Construir imagen Docker
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

docker-push: ## Subir imagen a registro
	docker push $(IMAGE_NAME):$(IMAGE_TAG)

docker-up: ## Iniciar con Docker Compose
	docker-compose up

docker-dev: ## Iniciar en modo desarrollo con Docker
	docker-compose --profile dev up wapi-dev

docker-down: ## Detener Docker Compose
	docker-compose down

# Kubernetes commands
k8s-check: ## Verificar requisitos para Kubernetes
	./deploy.sh check

k8s-deploy: ## Desplegar en Kubernetes
	./deploy.sh deploy

k8s-full: ## Build, push y deploy en Kubernetes
	IMAGE_NAME=$(IMAGE_NAME) IMAGE_TAG=$(IMAGE_TAG) ./deploy.sh full

k8s-status: ## Ver estado del deployment en Kubernetes
	./deploy.sh status

k8s-logs: ## Ver logs de la aplicación en Kubernetes
	./deploy.sh logs

k8s-shell: ## Abrir shell en el pod
	./deploy.sh shell

k8s-update: ## Actualizar deployment con nueva imagen
	IMAGE_NAME=$(IMAGE_NAME) IMAGE_TAG=$(IMAGE_TAG) ./deploy.sh update

k8s-rollback: ## Hacer rollback del deployment
	./deploy.sh rollback

k8s-backup: ## Crear backup de volúmenes
	./deploy.sh backup

k8s-delete: ## Eliminar deployment de Kubernetes
	./deploy.sh delete

# Cleanup
clean: ## Limpiar archivos temporales
	rm -rf .next
	rm -rf node_modules/.cache

clean-all: clean ## Limpiar todo incluido node_modules
	rm -rf node_modules
	rm -rf pnpm-lock.yaml
