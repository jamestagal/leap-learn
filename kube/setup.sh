#!/bin/bash

set -a
source ./.env
set +a


# ------ K3s Setup ------

echo "Installing K3s on master node..."
ssh -i ${MASTER_SERVER_KEY} ${MASTER_SERVER_USER}@${MASTER_SERVER_IP} << EOF
    curl -sfL https://get.k3s.io | sh -
EOF

# Optional - installing K3s on worker node only if WORKER_NAME is set
if [ ! -z "${WORKER_NAME}" ]; then
echo "WORKER_NAME is set. Installing worker node..."

echo "Extracting the server token..."
SERVER_TOKEN=$(ssh -i ${MASTER_SERVER_KEY} ${MASTER_SERVER_USER}@${MASTER_SERVER_IP} << 'EOF'
  sudo cat /var/lib/rancher/k3s/server/node-token
EOF
)
SERVER_TOKEN=$(echo "$SERVER_TOKEN" | grep -o 'K[0-9a-f]*::server:[0-9a-f]*')

echo "Installing K3s on worker node..."
ssh -i ${WORKER_SERVER_KEY} ${WORKER_SERVER_USER}@${WORKER_SERVER_IP} << EOF
  curl -sfL https://get.k3s.io | K3S_URL=https://${MASTER_SERVER_IP}:6443 K3S_TOKEN=${SERVER_TOKEN} K3S_NODE_NAME=${WORKER_NAME} sh -
EOF
else
  echo "WORKER_NAME not set. Skipping worker node installation."
fi

echo "Configuring local kubeconfig..."
mkdir -p $HOME/.kube
touch $HOME/.kube/config
rm -f $HOME/.kube/config_new
rm -f $HOME/.kube/config_backup
mv $HOME/.kube/config $HOME/.kube/config_backup

# Copy the kubeconfig from the master node
scp -i ${MASTER_SERVER_KEY} ${MASTER_SERVER_USER}@${MASTER_SERVER_IP}:/etc/rancher/k3s/k3s.yaml $HOME/.kube/config_new
sed -i "s/127.0.0.1/${MASTER_SERVER_IP}/g" $HOME/.kube/config_new
sed -i "s/default/${CONTEXT}/g" $HOME/.kube/config_new

# Merge the kubeconfig files
KUBECONFIG=$HOME/.kube/config_backup:$HOME/.kube/config_new kubectl config view --merge --flatten > $HOME/.kube/config

# Switch to the specified context
kubectl config use-context $CONTEXT

echo "Verifying Kubernetes context..."
CURRENT_KUBECTL_CONTEXT=$(kubectl config current-context)
if [ "$CURRENT_KUBECTL_CONTEXT" != "$CONTEXT" ]; then
  echo "Error: Not on the correct Kubernetes context. Expected '$CONTEXT', but on '$CURRENT_KUBECTL_CONTEXT'." >&2
  echo "Please ensure your kubeconfig is correctly set up and the context '$CONTEXT' exists and is active." >&2
  exit 1
else
  echo "Context '$CONTEXT' verified successfully."
fi

# ------ Helm Setup ------

helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo add vm https://victoriametrics.github.io/helm-charts/
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update

# ------ Secrets Setup ------

echo "Creating a secret for the Github Docker registry..."
echo $GITHUB_ACCESS_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin
kubectl create secret generic regcred \
    --from-file=.dockerconfigjson=$DOCKER_CONFIG_JSON \
    --type=kubernetes.io/dockerconfigjson

echo "Creating a CronJob secret..."
kubectl create secret generic api-secrets \
  --from-literal=task-token=$TASK_TOKEN

# Uncomment if using Google Cloud SQL
# echo "Creating a PostgreSQL secret..."
# kubectl create secret generic db-secrets -n default \
#   --from-literal=host=$POSTGRES_HOST \
#   --from-literal=port=$POSTGRES_PORT \
#   --from-literal=dbname=$POSTGRES_DB \
#   --from-literal=username=$POSTGRES_USER \
#   --from-literal=password=$POSTGRES_PASSWORD
# echo "Creating a Google Cloud service account secret..."
# kubectl create secret generic gcp-sa-key \
#   --from-file=key.json=./gcp-sa-key.json \

# ------ CloudNativePG Setup ------
# Comment if not using CloudNativePG

kubectl create namespace db

echo "Creating a CloudNativePG backup secret..."
kubectl create secret generic backup-secrets -n db \
  --from-literal=access_key_id=$BACKUP_ACCESS_KEY_ID \
  --from-literal=secret_access_key=$BACKUP_SECRET_ACCESS_KEY

echo "Installing Cloud Native PostgreSQL Operator..."
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.25/releases/cnpg-1.25.0.yaml

echo "Waiting for Cloud Native PostgreSQL Operator to be ready..."
kubectl wait -n cnpg-system --for=condition=Available --timeout=300s deployment/cnpg-controller-manager

echo "Installing PostgreSQL cluster..."
envsubst < ./config/db-postgres.yaml | kubectl apply -n db -f -

echo "Installing PostgreSQL backup job..."
kubectl apply -n db -f ./config/db-postgres-backup.yaml 

echo "Creating a CloudNativePG cluster secret..."
kubectl create secret generic db-secrets -n default \
  --from-literal=username=$(kubectl get secret -n db postgres-app -o jsonpath='{.data.username}' | base64 --decode) \
  --from-literal=password=$(kubectl get secret -n db postgres-app -o jsonpath='{.data.password}' | base64 --decode) \
  --from-literal=host=$(kubectl get secret -n db postgres-app -o jsonpath='{.data.host}' | base64 --decode).db \
  --from-literal=port=$(kubectl get secret -n db postgres-app -o jsonpath='{.data.port}' | base64 --decode) \
  --from-literal=dbname=$(kubectl get secret -n db postgres-app -o jsonpath='{.data.dbname}' | base64 --decode)

# ------ Monitoring Setup ------

kubectl create namespace monitoring

echo "Installing VictoriaMetrics..."
helm install vms vm/victoria-metrics-single -n monitoring -f ./config/monitoring-vms.yaml

echo "Installing VictoriaLogs..."
helm install vls vm/victoria-logs-single -n monitoring -f ./config/monitoring-vls.yaml

echo "Installing OpenTelemetry Collector..."
helm install otel-collector open-telemetry/opentelemetry-collector -n monitoring -f ./config/monitoring-otel.yaml

echo "Installing Tempo..."
helm install tempo grafana/tempo -n monitoring -f ./config/monitoring-tempo.yaml

echo "Installing Grafana..."
envsubst < ./config/monitoring-grafana.yaml | helm install grafana grafana/grafana -n monitoring -f -

# ------ PubSub Setup ------

kubectl create namespace pubsub

echo "Installing NATS..."
helm install nats nats/nats -n pubsub -f ./config/pubsub-nats.yaml

# ------ Cron Job Setup ------

echo "Installing Cron Job..."
kubectl apply -f ./config/service-cron.yaml 

# ------ Application Setup ------

echo "Installing application..."
envsubst < ./config/service-core.yaml | kubectl apply -f -

envsubst < ./config/service-core-sv.yaml | kubectl apply -f -

envsubst < ./config/service-admin.yaml | kubectl apply -f -

envsubst < ./config/service-admin-sv.yaml | kubectl apply -f -

envsubst < ./config/service-client.yaml | kubectl apply -f -

envsubst < ./config/service-client-sv.yaml | kubectl apply -f -

envsubst < ./config/service-ingress.yaml | kubectl apply -f -

# ------ Information ------
echo ""
echo "Setup completed successfully!"
echo ""
echo "Check the status of your deployments:"
echo "kubectl get pods or k9s"
echo ""
echo "Access Grafana at https://$GRAFANA_URL."
echo "Username: admin."
echo "Password: $(kubectl get secret -n monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode)"
echo ""
echo "PostgreSQL connection details, save these to GitHub Secrets for use in migrations:"
echo "DB_NAME: $(kubectl get secret -n db postgres-app -o jsonpath='{.data.dbname}' | base64 --decode)"
echo "DB_USER: $(kubectl get secret -n db postgres-app -o jsonpath='{.data.username}' | base64 --decode)"
echo "DB_PASSWORD: $(kubectl get secret -n db postgres-app -o jsonpath='{.data.password}' | base64 --decode)"
echo ""
echo "Copy the local kubeconfig and save it as KUBE_CONFIG in GitHub Secrets:"
echo "cat $HOME/.kube/config"

