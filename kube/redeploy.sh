# Switch context
kubectl config use-context $CONTEXT

envsubst < ./config/service-core.yaml | kubectl apply -f -

envsubst < ./config/service-core-sv.yaml | kubectl apply -f -

envsubst < ./config/service-admin.yaml | kubectl apply -f -

envsubst < ./config/service-admin-sv.yaml | kubectl apply -f -

envsubst < ./config/service-client.yaml | kubectl apply -f -

envsubst < ./config/service-client-sv.yaml | kubectl apply -f -

envsubst < ./config/service-ingress.yaml | kubectl apply -f -
