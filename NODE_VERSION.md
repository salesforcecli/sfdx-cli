# Node Version

Node is bundled with the oclif tarballs which is specified in (package.json).oclif.node.

In order to cache node on circleci, we need to checksum a file. We can't checksum the entire package.json since the version and dependencies change every week, so we maintain a seperate hardcoded reference to the node version here.

node=14.15.4
