#!/bin/bash

rsync -avz -e ssh --stats --progress . \
  --exclude "build" \
  --exclude ".git" \
  --exclude "node_modules" \
  k8s.moon:devops/imageprocessor

ssh k8s.moon \
  'cd devops/imageprocessor ;\
   sudo docker build -t imageprocessor . ;\
   sudo docker image tag imageprocessor registry.moon:80/imageprocessor ;\
   sudo docker push registry.moon:80/imageprocessor ;\
   kubectl -n moon rollout restart deployment imageprocessor'


