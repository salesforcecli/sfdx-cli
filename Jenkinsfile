library identifier: 'salesforcedx-library'
/**
 * Jenkinsfile for force-com-toolbelt project.
 * This Jenkinsfile is for use in a Multibranch Jenkins pipeline job ONLY.
 * The Entry-point into this code will attempt to run the current set of pipeline steps
 * according to the Jenkins job name. If the job name includes the word "unit", then unit
 * tests will be run and if the job name includes the word "integration"
 * then the integration tests will be run.
 *
 * So a Jenkins job name of Appcloud-Unit-CI will run the unit tests and a job named
 * Appcloud-Integration-Tests will run the integration tests'
 *
 * If no match is made based on job name, then unit tests are run.
 */

enum PLATFORM {
    LINUX, WINDOWS, MAC
}

/**
 * Run tests in shell environment
 */
def runCommands(PLATFORM os, String testResultsName) {
    try {
        runTheJob(os)
    } finally {
        stash includes: '*xunit.xml,*checkstyle.xml,*coverage/*, **/stderr.txt, **/stdout.txt, **/test-result*.*, success.txt', name: testResultsName
    }
}

def jobMatches(String regex) {
    return env.JOB_NAME.toLowerCase().matches(regex)
}

def runTheJob(PLATFORM os) {
    properties([
        buildDiscarder(logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '10')),
        pipelineTriggers([])
    ])

    step([$class: 'GitHubSetCommitStatusBuilder'])

    if (jobMatches(/.*unit.*/)) {
        doUnitTests(os);
        cleanupTestWorkspace(os)
    }
}

def cleanupTestWorkspace(PLATFORM os) {
    stage('Clean up unit test results') {
        withEnv([
            "HOME=${env.WORKSPACE}",
            "APPDATA=${env.WORKSPACE}",
            "USERPROFILE=${env.WORKSPACE}"
        ])
        {
            def DIST_FOLDER = 'dist'
            def TEST_FOLDER = 'test'
            def RESULT_DIRS = 'testRootDir*'
            switch(os) {
                case PLATFORM.MAC:
                case PLATFORM.LINUX:
                    sh "rm -rf ${DIST_FOLDER}/${TEST_FOLDER}/${RESULT_DIRS}"
                    sh "ls -l ${DIST_FOLDER}/${TEST_FOLDER}"
                    break
                case PLATFORM.WINDOWS:
                    bat "powershell -Command \"Remove-Item -Recurse -Force ${DIST_FOLDER}\\${TEST_FOLDER}\\${RESULT_DIRS}\""
                    bat "dir ${DIST_FOLDER}\\${TEST_FOLDER}"
                    break
            }
            echo 'Finished cleaning test workspaces.'
        }
    }
}

/**
 * The stages necessary to accomplish unit tests
 */
def doUnitTests(PLATFORM os) {
    //npmInstall(os)

    stage('Run Unit tests/checkstyle/coverage')
    {
        withEnv([
            "HOME=${env.WORKSPACE}",
            "APPDATA=${env.WORKSPACE}",
            "USERPROFILE=${env.WORKSPACE}"
        ])
        {
            switch(os) {
                case PLATFORM.MAC:
                case PLATFORM.LINUX:
                    rc = sh returnStatus: true, script: 'yarn test'
                    if (rc != 0)
                    {
                        currentBuild.result = 'Unstable'
                    }
                    //rc = sh returnStatus: true, script: 'npm run coverage-report'
                    //rc = sh returnStatus: true, script: 'mv checkstyle.xml linux-checkstyle.xml; mv xunit.xml linux-unit-xunit.xml; rm -rf linuxunitcoverage; mv coverage linuxunitcoverage'
                    break
                case PLATFORM.WINDOWS:
                    rc = bat returnStatus: true, script: 'yarn test'
                    if (rc != 0)
                    {
                        currentBuild.result = 'Unstable'
                    }
                    // rc = bat returnStatus: true, script: 'node node_modules\\istanbul\\lib\\cli.js cover --report html node_modules\\mocha\\bin\\_mocha -- -t 240000 --recursive dist\\test\\unit -R xunit-file'
                    // if (rc != 0)
                    // {
                    //     currentBuild.result = 'Unstable'
                    // }
                    // rc = bat returnStatus: true, script: 'ren checkstyle.xml windows-checkstyle.xml'
                    // rc = bat returnStatus: true, script: 'ren xunit.xml windows-unit-xunit.xml'
                    // rc = bat returnStatus: true, script: 'ren coverage windowsunitcoverage'
                    break
            }
        }
    }
}

/**
* Rollup coverage data files from unit and integration tests
*/
def rollupCoverage() {
    def unitCoverageExists = fileExists './linuxunitcoverage/coverage.json'
    def integrationCoverageExists = fileExists './linuxintegrationcoverage/coverage.json'

    def coverageFiles = ''

    if (unitCoverageExists) {
        coverageFiles = '-c ./linuxunitcoverage/coverage.json '
    }

    if (integrationCoverageExists) {
        coverageFiles += ' -c ./linuxintegrationcoverage/coverage.json '
    }

    if (coverageFiles != '') {
        rc = sh returnStatus: true, script: "ci-utils rollupcoverage ${coverageFiles} -o ./linuxintegrationcoverage"
    }
}

/**
 * Run npm install of toolbelt to local directory.
 * @return
 */
def npmInstallInternal(PLATFORM os, linkHeroku = false) {
    try {
        setGithubProxy(os)

        def home = env.WORKSPACE
        def npmPublicProxy = env.NPM_PUBLIC_PROXY
        def npmCacheDir = env.NPM_CACHE_DIR
        if (npmCacheDir != null) {
            npmCacheDir = "-c ${npmCacheDir}"
        } else {
            npmCacheDir = ''
        }
            withEnv([
              "HOME=${home}",
              "APPDATA=${home}",
              "USERPROFILE=${home}"
            ]) {
                switch(os) {
                    case PLATFORM.LINUX:
                    case PLATFORM.MAC:
                        if (npmPublicProxy != null) {
                            sh "npm config set prefix ${home}"
                            sh "npm config set https-proxy ${npmPublicProxy} -g"
                            sh "npm config set proxy ${npmPublicProxy} -g"
                        }
                        sh "npm-cache install ${npmCacheDir} npm"
                        sh 'npm run compile'
                        if (linkHeroku) {
                          withEnv([
                              "HOME=${home}",
                              "XDG_DATA_HOME=${home}"
                          ]) {
                               sh 'sfdx plugins:link .;sfdx force --help'
                            }
                        }
                        break
                    case PLATFORM.WINDOWS:
                        if (npmPublicProxy != null) {
                            bat "npm config set prefix ${home}"
                            bat "npm config set https-proxy ${npmPublicProxy} -g"
                            bat "npm config set proxy ${npmPublicProxy} -g"
                        }
                        bat "npm-cache install ${npmCacheDir} npm"
                        bat 'npm run compile'
                        if (linkHeroku) {
                            withEnv([
                                "HOME=${home}",
                                "XDG_DATA_HOME=${home}"
                            ]) {
                                        bat "\"${env.WINDOWS_SFDX_BINARY}\" plugins:link ."
                                        bat "\"${env.WINDOWS_SFDX_BINARY}\" force --help"
                            }
                        }
                        break
                }
            }
        } finally {
            unsetGithubProxy(os)
        }
}

/**
 * Run npm install of toolbelt to local directory.
 * @return
 */
def npmInstall(PLATFORM os, linkHeroku = false) {
    stage('Install Toolbelt') {
        def withEnvParams = env.SFDX_PUBLIC_PROXY != null ? ["http_proxy=${env.SFDX_PUBLIC_PROXY}","https_proxy=${env.SFDX_PUBLIC_PROXY}"] : []
        withEnv(withEnvParams) {
            npmInstallInternal(os, linkHeroku)
        }
    }
}

/**
 * post results to github
 */
def postResultsToGithub() {
    // post back to Github
    echo 'postResultsToGithub'
    stage('Post results to Github') {
        currentBuild.result = currentBuild.result?: 'SUCCESS'
        step([
            $class: 'GitHubCommitStatusSetter',
            errorHandlers: [
                [$class: 'ShallowAnyErrorHandler']
            ],
            statusResultSource: [
                $class: 'ConditionalStatusResultSource',
                results: [
                    [$class: 'BetterThanOrEqualBuildResult', result: 'SUCCESS', state: 'SUCCESS', message: currentBuild.description],
                    [$class: 'BetterThanOrEqualBuildResult', result: 'FAILURE', state: 'FAILURE', message: currentBuild.description],
                    [$class: 'AnyBuildResult', state: 'FAILURE', message: 'The state of the build could not be determined!']
                ]
            ]
        ])
    }
}

/**
 * post the test results
 */
def collectTestResults() {
    stage('Collect Test Results') { junit '*xunit.xml,**/test-result*.xml' }
}

def coverageNotifications(coverageDir) {
    def coverageExists = fileExists "${coverageDir}/coverage-summary.json"
    if (coverageExists) {
        def summary = readJSON file: "${coverageDir}/coverage-summary.json"
        if (summary && summary['total']) {
            currentBuild.result = (summary.total.lines ?: 0) < 70 ? 'Unstable' : currentBuild.result
            currentBuild.result = (summary.total.statements ?: 0) < 70 ? 'Unstable' : currentBuild.result
            currentBuild.result = (summary.total.functions ?: 0) < 70 ? 'Unstable' : currentBuild.result
            currentBuild.result = (summary.total.branches ?: 0) < 70 ? 'Unstable' : currentBuild.result
        }
    }
}

/**
 * post the code coverage results - only done in HTML format since cobertura plugin is not yet supported in pipelines
 */
def collectCoverageResults() {
    stage('Collect Coverage Results') {
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'linuxunitcoverage', reportFiles: 'index.html', reportName: 'Linux Unit Test Coverage Report'])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: true, reportDir: 'linuxintegrationcoverage', reportFiles: 'index.html', reportName: 'Linux Integration Test Coverage Report'])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'windowsunitcoverage', reportFiles: 'index.html', reportName: 'Windows Unit Test Coverage Report'])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'integration-coverage', reportFiles: 'index.html', reportName: 'Windows Integration Test Coverage Report'])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: true, reportDir: 'teamcoverage', reportFiles: 'index.html', reportName: 'Code Coverage by Team (Integration)'])

        echo 'Publish Coverage Notifications for entire project'
        coverageNotifications('./linuxintegrationcoverage')

        // by team coverage health
        def teamSummaryFiles = findFiles glob: 'teamcoverage/**/coverage-summary.json'
        for (int i = 0; i < teamSummaryFiles.length; i++) {
            def teamSummaryFile = new File(teamSummaryFiles[i].path)
            echo "Publish Coverage Notifications for team ${teamSummaryFile.getParent()}"
            coverageNotifications(teamSummaryFile.getParent())
        }
    }
}

/**
 * post checkstyle results
 */
def collectCheckstyleResults() {
    // post checkstyle results
    stage('Collect Checkstyle results') {
        step([$class: 'CheckStylePublisher', canComputeNew: false, canRunOnFailed: true, defaultEncoding: '', healthy: '', pattern: '*checkstyle.xml', unHealthy: '95'])
    }
}

def setGithubProxy(PLATFORM os) {
    def home = env.WORKSPACE
    def gitPublicProxy = env.GIT_PUBLIC_PROXY
    if (gitPublicProxy != null) {
        withEnv([
            "HOME=${home}",
            "APPDATA=${home}",
            "USERPROFILE=${home}"
        ]) {
            switch(os) {
                case PLATFORM.LINUX:
                case PLATFORM.MAC:
                    sh "git config --global http.proxy ${gitPublicProxy}"
                    break
                case PLATFORM.WINDOWS:
                    bat "git config --global http.proxy ${gitPublicProxy}"
                    break
            }
        }
    }
}

def unsetGithubProxy(PLATFORM os) {
    def home = env.WORKSPACE
    def gitPublicProxy = env.GIT_PUBLIC_PROXY

    if (gitPublicProxy != null) {
        withEnv([
            "HOME=${home}",
            "APPDATA=${home}",
            "USERPROFILE=${home}"
        ]) {

            switch(os) {
                case PLATFORM.LINUX:
                case PLATFORM.MAC:
                    sh "git config --global --unset http.proxy"
                    break
                case PLATFORM.WINDOWS:
                    bat "git config --global --unset http.proxy"
                    break
            }
        }
    }
}

/**
 * Returns the list of email recipients for the current job
 */
def getEmailRecipients() {
    if (jobMatches(/.*steelbrick-validation.*/) && currentBuild.result != "SUCCESS") {
        return "${env.SDD_TEAM}"
    } else {
        return ''
    }
}

/**
* Remove contents of node_modules directory in the workspace
* Needs to be run only on Jenkins Master (assuming Linux)
*/
def cleanupNodeModules() {
    dir('node_modules') {
        treeResults = sh returnStdout: true, script: 'find .'
        sh 'rm -fr .bin'
        sh 'rm -fr *'
        writeFile encoding: 'utf8', file: 'node_dir_tree.txt', text: treeResults
    }
}

/**
 * Create a node execution to be used with parallel function
 */
def createNodeExecution(PLATFORM os, String nodeLabel, String nodeResultsName) {
    return {
        node (nodeLabel) {
            deleteDir()

            if (jobMatches(/.*perfci.*/)) {
                dir('toolbelt') {
                    checkout scm
                    npmInstall(os, true)
                }
                dir('perfCI') {
                    runCommands(os, nodeResultsName)
                }
            } else if (jobMatches(/.*sfdx-dreamhouse.*/)) {
                dir('toolbelt') {
                    checkout scm
                    npmInstall(os, true)
                }
                dir('sfdx-dreamhouse') {
                    runCommands(os, nodeResultsName)
                }
            } else if (jobMatches(/.*steelbrick-validation.*/)) {
                dir('toolbelt') {
                    checkout scm
                    npmInstall(os, true)
                }
                dir('steelbrick-workspace') {
                    runCommands(os, nodeResultsName)
                }
            } else {
                checkout scm
                runCommands(os, nodeResultsName)
            }
        }
    }
}

def teamsWithFailedTests = [:]
def shouldCollectResults = true

try {
    loadProperties(env.TEST_PROPERTIES_BRANCH_OVERRIDE ?: env.CHANGE_TARGET ?: env.BRANCH_NAME)
    currentBuild.result = "SUCCESS"

    // Get all nodes (master & slave)
    def computers = Jenkins.getInstance().getComputers()
    // Map to save the node execution commands. Will be passed to the parallel function
    def nodes = [:]
    // An array to save the nodes map keys to be used to unstash build results later.
    // Cannot just use nodes.keySet because of a bug with .each loops in Pipeline.
    def nodeNames = new String[computers.length]
    // There's a known foreach bug in Pipeline CPS-transformed code, so we use C-style loop here.
    for (int i = 0; i < computers.length; i++) {
        // Make sure the node is online
        if (!computers[i].isOffline()) {
            def props = computers[i].getSystemProperties()
            def osname = props['os.name']
            if (osname.contains('Mac')) {
                nodeNames[i] = "${PLATFORM.MAC}-test-results".toString()
                nodes[nodeNames[i]] = createNodeExecution(PLATFORM.MAC, 'mac', nodeNames[i])
            } else if (osname.contains('Linux')) {
                nodeNames[i] = "${PLATFORM.LINUX}-test-results".toString()
                nodes[nodeNames[i]] = createNodeExecution(PLATFORM.LINUX, 'linux', nodeNames[i])
            } else if (osname.contains('Windows')) {
                // don't run perfCI job on Windows node yet
                if (!jobMatches(/.*perfci.*/) && !jobMatches(/.*steelbrick-validation.*/) && !jobMatches(/.*q3-smoketest.*/) && !jobMatches(/.*dreamhouse.*/)) {
                    nodeNames[i] = "${PLATFORM.WINDOWS}-test-results".toString()
                    nodes[nodeNames[i]] = createNodeExecution(PLATFORM.WINDOWS, 'windows', nodeNames[i])
                }
            }
        }
    }

    parallel nodes

    shouldCollectResults = !jobMatches(/.*steelbrick-validation.*/) && !jobMatches(/.*perfci.*/) && !jobMatches(/.*dreamhouse.*/)

    stage('Collect results') {
        node() {
            if (shouldCollectResults) {
                // There's a known foreach bug in Pipeline CPS-transformed, so we use C-style loop here.
                for (int i = 0; i < nodeNames.length; i++) {
                    if (nodeNames[i] != null) {
                        unstash nodeNames[i]
                    }
                }
                def moduleMap = readJSON file: './src/test/moduleOwner.json'

                def checkStyleFiles = findFiles glob: '*checkstyle.xml'

                for (int f= 0; f < checkStyleFiles.size(); f++) {
                    echo "Processing checkstyle result file ${checkStyleFiles[f].path}"
                    checkstyleText = readFile encoding: 'utf8', file: checkStyleFiles[f].path
                    groovy.util.Node checkstyle = new XmlParser().parseText(checkstyleText)
                    teamsWithFailedTests = mapCheckstyleFailuresToTeam(checkstyle, "${env.WORKSPACE}/src", moduleMap, teamsWithFailedTests)
                }

                def xunitFiles = findFiles glob: '*xunit.xml'

                for (int f= 0; f < xunitFiles.size(); f++) {
                    echo "Processing test result file ${xunitFiles[f].path}"
                    xunitText = readFile encoding: 'utf8', file: xunitFiles[f].path
                    groovy.util.Node testsuite = new XmlParser().parseText(xunitText)
                    teamsWithFailedTests = mapTestFailuresToTeam(testsuite, "${env.WORKSPACE}/src", moduleMap, teamsWithFailedTests)
                }

                def packageJson = loadPackageJson('package.json')
                saveTestFailures(toJson(teamsWithTestFailuresToArray(teamsWithFailedTests)), 'testFailures.json', packageJson['version'] ?: 'unknown')

                withCredentials([usernamePassword(credentialsId: 'GUS_UNAME_PASSWORD', passwordVariable: 'gusUserPassword', usernameVariable: 'gusUsername')]) {
                    if ((env.DO_NOT_CREATE_BUGS ?: 'false') == 'false') { // be able to stop the bug creation process if needed
                        echo 'creating bugs'
                        def params = []
                        if (env.NPM_PUBLIC_PROXY != null) {
                            params = ["https_proxy=${env.NPM_PUBLIC_PROXY}", "proxy=${env.NPM_PUBLIC_PROXY}"]
                        }
           				withEnv(params) {
           				    // Only create test failure bugs for base branches
                            if (!(env.BRANCH_NAME?:'').matches(/^PR-[0-9]{1,10}/)) {
                                echo 'creating bugs in branch'
                                createTestFailureBugs('Platform - DX', 'sfdx.cli', gusUsername, gusUserPassword, 'testFailures.json')
                            }
                        }
                    }
                }

                collectTestResults()
                collectCheckstyleResults()
                collectCoverageResults()
            }
            postResultsToGithub()
            cleanupNodeModules()
        }
    }
} finally {
    stage('Send email') {
        node() {
            def emailRecipients = getEmailRecipients()
            sendEmails(emailRecipients, teamsWithFailedTests)
        }
    }
}
