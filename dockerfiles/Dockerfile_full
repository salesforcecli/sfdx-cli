FROM heroku/heroku:18

ENV DEBIAN_FRONTEND=noninteractive
ARG SALESFORCE_CLI_VERSION=latest
RUN apt-get update
RUN echo '2d316e55994086e41761b0c657e0027e9d16d7160d3f8854cc9dc7615b99a526  ./nodejs.tar.gz' > node-file-lock.sha \
  && curl -s -o nodejs.tar.gz https://nodejs.org/dist/v12.18.2/node-v12.18.2-linux-x64.tar.gz \
  && shasum --check node-file-lock.sha
RUN mkdir /usr/local/lib/nodejs \
  && tar xf nodejs.tar.gz -C /usr/local/lib/nodejs/ --strip-components 1 \
  && rm nodejs.tar.gz node-file-lock.sha
ENV PATH=/usr/local/lib/nodejs/bin:$PATH
RUN npm install --global sfdx-cli@${SALESFORCE_CLI_VERSION}

RUN apt-get install --assume-yes \
  openjdk-11-jdk-headless \
  jq

RUN apt-get autoremove --assume-yes \
  && apt-get clean --assume-yes \
  && rm -rf /var/lib/apt/lists/*

ENV SFDX_CONTAINER_MODE true
ENV DEBIAN_FRONTEND=dialog
ENV SHELL /bin/bash