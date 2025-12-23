# MiniDocter Android Development Makefile

# Environment setup
export JAVA_HOME := /usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME := $(HOME)/Android/Sdk
export NVM_DIR := $(HOME)/.nvm
export PATH := $(JAVA_HOME)/bin:$(ANDROID_HOME)/platform-tools:$(PATH)

# Load nvm if available
SHELL := /bin/bash
.SHELLFLAGS := -c 'source $(NVM_DIR)/nvm.sh 2>/dev/null; set -e; $$0 "$$@"'

# Default phone IP and ports (override with: make connect PHONE_IP=192.168.1.100)
PHONE_IP ?= 192.168.1.245
PHONE_PORT ?= 36979
PAIR_PORT ?= 37171

# ADB shortcuts
.PHONY: devices
devices:
	@echo "Checking connected devices..."
	adb devices -l

.PHONY: pair
pair:
	@echo "Pairing with phone at $(PHONE_IP):$(PAIR_PORT)"
	@echo "Enter the pairing code shown on your phone:"
	adb pair $(PHONE_IP):$(PAIR_PORT)

.PHONY: connect
connect:
	@echo "Connecting to phone at $(PHONE_IP):$(PHONE_PORT)"
	adb connect $(PHONE_IP):$(PHONE_PORT)

.PHONY: disconnect
disconnect:
	@echo "Disconnecting from all devices..."
	adb disconnect

.PHONY: kill-server
kill-server:
	@echo "Killing ADB server..."
	adb kill-server
	@echo "Starting ADB server..."
	adb start-server

.PHONY: logcat
logcat:
	@echo "Showing error logs (Ctrl+C to stop)..."
	adb logcat *:E

.PHONY: logcat-app
logcat-app:
	@echo "Showing app logs (Ctrl+C to stop)..."
	adb logcat | grep -E "ReactNativeJS|AndroidRuntime"

.PHONY: reload
reload:
	@echo "Reloading React Native app..."
	adb shell input text "RR"

# Build shortcuts (local)
.PHONY: build-debug
build-debug:
	@echo "Building debug APK..."
	npx expo run:android

.PHONY: build-release
build-release:
	@echo "Building release APK..."
	npx expo run:android --variant release

# EAS Cloud Build shortcuts (reads ENV from .env file)
.PHONY: show-env
show-env: .SHELLFLAGS = -c
show-env:
	@if [ ! -f .env ]; then \
		echo "ERROR: No .env file found"; \
	else \
		ENV=$$(grep '^EXPO_PUBLIC_APP_ENV=' .env | cut -d= -f2); \
		if [ -z "$$ENV" ]; then \
			echo "ERROR: EXPO_PUBLIC_APP_ENV not set in .env"; \
		else \
			echo "Current EXPO_PUBLIC_APP_ENV from .env: $$ENV"; \
		fi; \
	fi

# Validation function for EAS builds
define validate_env
	@if [ "$(ENV)" = "not_found" ]; then \
		echo "ERROR: No .env file found. Please create one with EXPO_PUBLIC_APP_ENV set."; \
		exit 1; \
	elif [ -z "$(ENV)" ]; then \
		echo "ERROR: EXPO_PUBLIC_APP_ENV not found in .env file. Please set it to: local, staging, or production"; \
		exit 1; \
	elif [ "$(ENV)" = "local" ]; then \
		echo "ERROR: Cannot use ENV=local for EAS builds. Your .env file is set to 'local'."; \
		echo "Use 'make build-debug' or 'make build-release' for local builds,"; \
		echo "or change EXPO_PUBLIC_APP_ENV in .env to 'staging' or 'production'."; \
		exit 1; \
	elif [ "$(ENV)" != "staging" ] && [ "$(ENV)" != "production" ]; then \
		echo "ERROR: Invalid ENV value in .env: $(ENV)"; \
		echo "EXPO_PUBLIC_APP_ENV must be one of: local, staging, or production"; \
		exit 1; \
	fi
endef

.PHONY: eas-build
eas-build: .SHELLFLAGS = -c
eas-build:
	@if [ ! -f .env ]; then echo "ERROR: No .env file found."; exit 1; fi; \
	ENV=$$(grep '^EXPO_PUBLIC_APP_ENV=' .env | cut -d= -f2); \
	if [ -z "$$ENV" ]; then echo "ERROR: EXPO_PUBLIC_APP_ENV not set in .env"; exit 1; \
	elif [ "$$ENV" = "local" ]; then echo "ERROR: Cannot use ENV=local for EAS builds."; exit 1; \
	elif [ "$$ENV" != "staging" ] && [ "$$ENV" != "production" ]; then echo "ERROR: Invalid ENV: $$ENV"; exit 1; fi; \
	echo "Building Android app for $$ENV environment..."; \
	npx eas-cli build --platform android --profile $$ENV

.PHONY: eas-build-ios
eas-build-ios: .SHELLFLAGS = -c
eas-build-ios:
	@if [ ! -f .env ]; then echo "ERROR: No .env file found."; exit 1; fi; \
	ENV=$$(grep '^EXPO_PUBLIC_APP_ENV=' .env | cut -d= -f2); \
	if [ -z "$$ENV" ]; then echo "ERROR: EXPO_PUBLIC_APP_ENV not set in .env"; exit 1; \
	elif [ "$$ENV" = "local" ]; then echo "ERROR: Cannot use ENV=local for EAS builds."; exit 1; \
	elif [ "$$ENV" != "staging" ] && [ "$$ENV" != "production" ]; then echo "ERROR: Invalid ENV: $$ENV"; exit 1; fi; \
	echo "Building iOS app for $$ENV environment..."; \
	npx eas-cli build --platform ios --profile $$ENV

.PHONY: eas-build-all
eas-build-all: .SHELLFLAGS = -c
eas-build-all:
	@if [ ! -f .env ]; then echo "ERROR: No .env file found."; exit 1; fi; \
	ENV=$$(grep '^EXPO_PUBLIC_APP_ENV=' .env | cut -d= -f2); \
	if [ -z "$$ENV" ]; then echo "ERROR: EXPO_PUBLIC_APP_ENV not set in .env"; exit 1; \
	elif [ "$$ENV" = "local" ]; then echo "ERROR: Cannot use ENV=local for EAS builds."; exit 1; \
	elif [ "$$ENV" != "staging" ] && [ "$$ENV" != "production" ]; then echo "ERROR: Invalid ENV: $$ENV"; exit 1; fi; \
	echo "Building both platforms for $$ENV environment..."; \
	npx eas-cli build --platform all --profile $$ENV

.PHONY: install-release
install-release:
	@echo "Installing release APK to connected device..."
	adb install -r android/app/build/outputs/apk/release/app-release.apk

.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	cd android && ./gradlew clean

.PHONY: clean-build
clean-build: clean build-release

# Use INCREMENT_VERSION=1 to increment version numbers
INCREMENT_VERSION ?= 0

.PHONY: build-bundle
build-bundle: .SHELLFLAGS = -c
build-bundle:
	@if [ ! -f .env ]; then echo "ERROR: No .env file found."; exit 1; fi; \
	export $$(grep -v '^#' .env | grep -v '^$$' | xargs); \
	if [ "$(INCREMENT_VERSION)" = "1" ]; then \
		echo "Incrementing version numbers..."; \
		CURRENT_VERSION_CODE=$$(grep 'versionCode' android/app/build.gradle | sed 's/[^0-9]*//g'); \
		NEW_VERSION_CODE=$$((CURRENT_VERSION_CODE + 1)); \
		CURRENT_VERSION_NAME=$$(grep 'versionName' android/app/build.gradle | sed 's/.*"\(.*\)".*/\1/'); \
		IFS='.' read -ra VERSION_PARTS <<< "$$CURRENT_VERSION_NAME"; \
		PATCH=$${VERSION_PARTS[2]}; \
		NEW_PATCH=$$((PATCH + 1)); \
		NEW_VERSION_NAME="$${VERSION_PARTS[0]}.$${VERSION_PARTS[1]}.$$NEW_PATCH"; \
		echo "Updating versionCode: $$CURRENT_VERSION_CODE -> $$NEW_VERSION_CODE"; \
		echo "Updating versionName: $$CURRENT_VERSION_NAME -> $$NEW_VERSION_NAME"; \
		sed -i "s/versionCode $${CURRENT_VERSION_CODE}/versionCode $${NEW_VERSION_CODE}/" android/app/build.gradle; \
		sed -i "s/versionName \"$${CURRENT_VERSION_NAME}\"/versionName \"$${NEW_VERSION_NAME}\"/" android/app/build.gradle; \
	else \
		echo "Building with current version (use INCREMENT_VERSION=1 to bump version)"; \
		CURRENT_VERSION_CODE=$$(grep 'versionCode' android/app/build.gradle | sed 's/[^0-9]*//g'); \
		CURRENT_VERSION_NAME=$$(grep 'versionName' android/app/build.gradle | sed 's/.*"\(.*\)".*/\1/'); \
		NEW_VERSION_CODE=$$CURRENT_VERSION_CODE; \
		NEW_VERSION_NAME=$$CURRENT_VERSION_NAME; \
	fi; \
	echo "Building release bundle (AAB)..."; \
	cd android && ./gradlew bundleRelease; \
	echo ""; \
	echo "✓ Bundle created at: android/app/build/outputs/bundle/release/app-release.aab"; \
	if [ "$(INCREMENT_VERSION)" = "1" ]; then \
		echo "✓ Version updated to: $$NEW_VERSION_NAME ($$NEW_VERSION_CODE)"; \
	else \
		echo "✓ Current version: $$NEW_VERSION_NAME ($$NEW_VERSION_CODE)"; \
	fi

# Development shortcuts
.PHONY: start
start:
	@echo "Starting Expo dev server..."
	npx expo start

.PHONY: start-clear
start-clear:
	@echo "Rebuilding Lexical editor..."
	npm run build:lexical
	@echo "Starting Expo dev server (clearing cache)..."
	npx expo start --clear

# Test commands
.PHONY: test
test:
	@echo "Running all tests..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "Running React Native tests..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	npm test
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "Running Lexical Editor tests..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	npm test --workspace=lexical-editor

.PHONY: test-rn
test-rn:
	@echo "Running React Native tests..."
	npm test

.PHONY: test-lexical
test-lexical:
	@echo "Running Lexical Editor tests..."
	npm test --workspace=lexical-editor

.PHONY: test-watch
test-watch:
	@echo "Running all tests in watch mode..."
	@echo "Note: Running React Native tests in watch mode."
	@echo "Open another terminal and run 'make test-lexical-watch' for lexical tests."
	npm test -- --watch

.PHONY: test-watch-lexical
test-watch-lexical:
	@echo "Running Lexical Editor tests in watch mode..."
	npm test --workspace=lexical-editor -- --watch

# Combined workflows
.PHONY: setup
setup: kill-server connect devices

.PHONY: deploy
deploy: build-release install-release

# Help
.PHONY: help
help:
	@echo "MiniDocter Android Development Commands"
	@echo ""
	@echo "ADB Commands:"
	@echo "  make devices         - List connected devices"
	@echo "  make pair            - Pair with phone (use PHONE_IP and PAIR_PORT vars)"
	@echo "  make connect         - Connect to phone (use PHONE_IP and PHONE_PORT vars)"
	@echo "  make disconnect      - Disconnect from all devices"
	@echo "  make kill-server     - Restart ADB server"
	@echo "  make logcat          - Show error logs"
	@echo "  make logcat-app      - Show app-specific logs"
	@echo "  make reload          - Reload the React Native app"
	@echo ""
	@echo "Build Commands (Local):"
	@echo "  make build-debug     - Build debug APK locally"
	@echo "  make build-release   - Build release APK locally"
	@echo "  make build-bundle    - Build release AAB for Play Store (use INCREMENT_VERSION=1 to bump version)"
	@echo "  make install-release - Install release APK to device"
	@echo "  make clean           - Clean build artifacts"
	@echo "  make clean-build     - Clean and rebuild release"
	@echo ""
	@echo "Build Commands (EAS Cloud):"
	@echo "  make show-env       - Show current EXPO_PUBLIC_APP_ENV from .env"
	@echo "  make eas-build      - Build Android on EAS (reads ENV from .env)"
	@echo "  make eas-build-ios  - Build iOS on EAS (reads ENV from .env)"
	@echo "  make eas-build-all  - Build both platforms on EAS (reads ENV from .env)"
	@echo "  Note: Set EXPO_PUBLIC_APP_ENV in .env to: staging or production"
	@echo ""
	@echo "Development Commands:"
	@echo "  make start           - Start Expo dev server"
	@echo "  make start-clear     - Start Expo dev server (clear cache)"
	@echo ""
	@echo "Test Commands:"
	@echo "  make test            - Run all tests (React Native + Lexical Editor)"
	@echo "  make test-rn         - Run React Native tests only"
	@echo "  make test-lexical    - Run Lexical Editor tests only"
	@echo "  make test-watch      - Run React Native tests in watch mode"
	@echo "  make test-watch-lexical - Run Lexical Editor tests in watch mode"
	@echo ""
	@echo "Workflows:"
	@echo "  make setup           - Reset ADB and connect to phone"
	@echo "  make deploy          - Build and install release APK"
	@echo ""
	@echo "Examples:"
	@echo "  make connect PHONE_IP=192.168.1.100 PHONE_PORT=5555"
	@echo "  make pair PHONE_IP=192.168.1.100 PAIR_PORT=37171"
	@echo "  make build-bundle                      # Build AAB with current version"
	@echo "  make build-bundle INCREMENT_VERSION=1  # Build AAB and increment version"
	@echo "  make eas-build           # Uses ENV from .env file"
	@echo "  make eas-build-all       # Build both iOS and Android"
