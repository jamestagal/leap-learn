sudo mkdir -p /etc/docker
sudo touch /etc/docker/daemon.json
echo '{ "metrics-addr" : "0.0.0.0:9323" }' | sudo tee /etc/docker/daemon.json > /dev/null
