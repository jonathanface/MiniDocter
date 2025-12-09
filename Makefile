# MiniDocter Android Development Makefile

# Environment setup
export JAVA_HOME := /usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME := $(HOME)/Android/Sdk
export PATH := $(JAVA_HOME)/bin:$(ANDROID_HOME)/platform-tools:$(PATH)

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

# Build shortcuts
.PHONY: build-debug
build-debug:
	@echo "Building debug APK..."
	npx expo run:android

.PHONY: build-release
build-release:
	@echo "Building release APK..."
	npx expo run:android --variant release

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

# Development shortcuts
.PHONY: start
start:
	@echo "Starting Expo dev server..."
	npx expo start

.PHONY: start-clear
start-clear:
	@echo "Starting Expo dev server (clearing cache)..."
	npx expo start --clear

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
	@echo ""
	@echo "Build Commands:"
	@echo "  make build-debug     - Build debug APK"
	@echo "  make build-release   - Build release APK"
	@echo "  make install-release - Install release APK to device"
	@echo "  make clean           - Clean build artifacts"
	@echo "  make clean-build     - Clean and rebuild release"
	@echo ""
	@echo "Development Commands:"
	@echo "  make start           - Start Expo dev server"
	@echo "  make start-clear     - Start Expo dev server (clear cache)"
	@echo ""
	@echo "Workflows:"
	@echo "  make setup           - Reset ADB and connect to phone"
	@echo "  make deploy          - Build and install release APK"
	@echo ""
	@echo "Examples:"
	@echo "  make connect PHONE_IP=192.168.1.100 PHONE_PORT=5555"
	@echo "  make pair PHONE_IP=192.168.1.100 PAIR_PORT=37171"
