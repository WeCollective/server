# WECO API

This repository contains the code for the RESTful API used by the WECO front-end.

# **Weco Codebase Setup Instructions For Local Development**
~ 2019

# Pre-setup Requirements

-   Download and install a [source code editor](https://en.wikipedia.org/wiki/Source_code_editor) and [terminal](https://www.quora.com/In-coding-terms-what-is-a-terminal-and-what-is-it-used-for)
    

	-   Recommended: [Virtual Studio Code](https://code.visualstudio.com/) integrates both (free and available for Windows, MacOS, and Linux)
    

-   Download and install Git: [](https://git-scm.com/download) [https://git-scm.com/download#](https://git-scm.com/download#)
    
-   Download and install Node.js: [https://nodejs.org/en/](https://nodejs.org/en/)
    
-   Download and Install Docker: [https://hub.docker.com/](https://hub.docker.com/)
    

	-   You have to use an account you can create one or you can ask for the shared one

-	Request the server environment variables file from Weco Admins
    

	-   Email james@weco.io or send us a message on Discord (make sure the file is named .env)
    

# Setup

-   Create a new folder on your hard drive to store the codebase
    
-   Open your terminal and navigate to the new folder
    
-   Clone the “webb app” (development branch) and “server” (local branch) repositories from [https://github.com/WeCollective](https://github.com/WeCollective) to the folder
    

	-   Enter “git clone --single-branch --branch develop https://github.com/WeCollective/webapp.git”
    
	-   Enter “git clone --single-branch --branch local [https://github.com/WeCollective/server.git](https://github.com/WeCollective/server.git)”
    

-   Navigate in your terminal to the “webapp” folder
    

	-   Enter “npm install”
    
	-   Enter “npm start”
    
	-   If this has worked correctly [https://localhost:8081](https://localhost:8081/) will now display Weco’s template in your browser but won’t load any content
    

-   Open a new terminal and navigate to the “server” folder
    

	-   Enter “npm install”
    
	-   Enter “npm run [start:local](https://github.com/WeCollective/server/blob/master/package.json#L15)” and wait for 4 minutes until the server and localstack have been correctly loaded
    
	-   If this has worked correctly [https://localhost:8081](https://localhost:8081/) will now load content from Weco’s [development environment](https://en.wikipedia.org/wiki/Deployment_environment#Development)
    

	-   Note: Posts and Users will be added only from the dump db files and any users or posts you create will not be kept throughout localstack restarts (to keep them you can add an entry as a json file at (lambda_stuff/dump/the corresponding table) )
    
	-   Changes made to your local code repository will now appear at [](https://localhost:8081/) [https://localhost:8081](https://localhost:8081)
    

-   This will start a service called localstack which emulates AWS services. Any changes or interactions with aws can be done using command-line arguments through the aws api, which should be installed already (see documentation at: https://docs.aws.amazon.com/cli/latest/index.html). It will run in the background until you stop it. It is suggested that you run it until you want to stop working as it takes 4 minutes to restart. At the end of the work session to stop it run:
    

	-   “npm run stop:localstack”
    
# Setup SSL first time running the project:

1. to run the project and use the certificates you have to install them first
2. to install them go to
	for server: config\ssl and double click on ia.p12, that will self-sign the cert for the api, just continue clicking next and accept at the end
	for the webapp: go to config\ssl and click on the ia.p12, install that (click next a bunch of times)
3. You're good to go! https should not give you a problem and certificates should show up as verified (little lock left of the url isn't red)
_P.S. Not green because the certificate is self-signed_


# Pushing changes to GitHub

-   We use the [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for the development of Weco’s codebase
    
-   Request to become a member of the WeCollective organisation on Github [here](https://github.com/orgs/WeCollective/people).
    
-   Create a new branch from the [local branch](https://github.com/WeCollective/server/tree/local) on the “server” repository and give it a unique name
    
-   Commit any changes you make in your local directory to the new branch and create a pull request to develop
    
-   When the branch is ready for review, let us know on discord or send an email to [james@weco.io](mailto:james@weco.io) so we can begin testing  out the feature you’ve developed.
    
-   If your feature is accepted, we will merge your new branch into the main [local branch](https://github.com/WeCollective/server/tree/local) and the changes will be deployed to the development environment

-   Changes will later be reviewed and live api will be updated

The front-end web application and server used for the WECO web application.

## Deployment
A branch can be deployed to an EB environment using `eb deploy <environment-name>`.

- The `master` branch is the main development branch for the project. It should be deployed to the `weco-dev` EB environment.
- The `production` branch is the production branch for the project, and is live to users. It should be deployed to the `weco-prod` EB environment, and only when all tests have passed.
