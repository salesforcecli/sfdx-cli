@echo off

set SFDX_INSTALLER=false&set BIN_NAME=run
REM @OVERRIDES@
set CLI_BINPATH=%~dp0%BIN_NAME%.cmd
set LATEST_BINPATH=%LOCALAPPDATA%\%BIN_NAME%\client\bin\%BIN_NAME%.cmd
if "%SFDX_INSTALLER%" == "true" (
    REM installer/update that shipped its own node binary
    if "%LATEST_BINPATH%"=="%CLI_BINPATH%" (
        REM latest version installed by the autoupdater
        "%~dp0node.exe" "%~dp0%BIN_NAME%.js" %*
    ) else if exist "%LATEST_BINPATH%" (
        REM if an autoupdater version exists and this is not it, run that instead
        "%LATEST_BINPATH%" %*
    ) else (
        REM must be an installer version
        "%~dp0..\client\bin\node.exe" "%~dp0..\client\bin\%BIN_NAME%.js" %*
    )
) else (
    REM npm install or local dev
    node "%~dp0run" %*
)
