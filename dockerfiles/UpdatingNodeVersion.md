## How Do I Create a New Hash To for CI Validation?

### Steps:

With NodeJs as an example.

1. [Download](https://nodejs.org/dist/) the file you wish to validate to a locally
   ex `curl -s -o nodejs.tar.gz https://nodejs.org/dist/v12.18.2/node-v12.18.2-linux-x64.tar.gz`

1. Use [shasum](https://ss64.com/osx/shasum.html) to generate a hash for the file your just downloaded.
   `shasum -a 256 ./nodejs.tar.gz`

1. Replace reference to the hash and file name in the Dockerfile with the output of step 2. Make sure you update all references to the old version of node and the url in the `curl` command.
