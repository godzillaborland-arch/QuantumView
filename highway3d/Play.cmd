@echo off
rem Double-click to play: starts the local server and opens Highway to Dhyana in your browser.
rem Keep this window open while playing; close it to stop the server.
title Highway to Dhyana server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8173 -Open
