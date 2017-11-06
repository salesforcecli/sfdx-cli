@echo off

set BIN_NAME=run
REM @OVERRIDES@
if (%BIN_NAME% == "run") (
    REM npm install or local dev
    node "%~dp0\run.js" %*
) else (
    REM installer/update that shipped its own node binary
    set CLI_BINPATH=%~dp0\%BIN_NAME%.cmd
    "%~dp0\node.exe" "%~dp0\%BIN_NAME%.js" %*
)
