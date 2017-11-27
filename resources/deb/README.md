Installing the Salesforce CLI on Ubuntu/Debian
==============================================

Add Salesforce repository to apt:

    sudo add-apt-repository "deb https://developer.salesforce.com/media/salesforce-cli/sfdx-cli/branches/stable/apt ./"

Install Heroku's release key for package verification:

    curl -L https://developer.salesforce.com/media/salesforce-cli/sfdx-cli/apt/release.key | sudo apt-key add -

Install the CLI:

    sudo apt-get update
    sudo apt-get install sfdx
