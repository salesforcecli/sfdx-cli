FROM node:8.9.1

RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen

RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
    apt-utils \
    python-dev \
    locales \
    p7zip \
    shellcheck \
  && \
  curl https://bootstrap.pypa.io/get-pip.py | python && \
  pip install awscli --upgrade && \
  aws configure set preview.cloudfront true && \
  apt-get remove -y python-dev && \
  apt-get clean && apt-get -y autoremove && \
  rm -rf /var/lib/apt/lists/* ~/.cache

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8
RUN locale-gen

CMD bash
