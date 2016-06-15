# WECO API

This repository contains the code for the RESTful API used by the WECO front-end.

## Deployment
A branch can be deployed to an EB environment using `eb deploy <environment-name>`.

- The `master` branch is the main development branch for the project. It should be deployed to the `weco-dev` EB environment.
- The `production` branch is the production branch for the project, and is live to users. It should be deployed to the `weco-prod` EB environment, and only when all tests have passed.
