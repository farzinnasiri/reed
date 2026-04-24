SHELL := /bin/bash
ENV ?= dev
ENV_FILE := .env.$(ENV)
CONVEX_TARGET := $(if $(filter prod production,$(ENV)),prod,dev)
EAS_ENV := $(if $(filter prod production,$(ENV)),production,development)

.PHONY: help install expo expo-clean convex-dev convex-codegen convex-deploy convex-env-push catalog-import env-check env-show eas-env-sync android-arm-dev android-arm-prod

help:
	@echo "make install           # npm install"
	@echo "make expo ENV=dev      # start Expo with .env.dev"
	@echo "make expo-clean ENV=dev # start Expo with .env.dev and clear Metro cache"
	@echo "make expo ENV=prod     # start Expo with .env.prod"
	@echo "make convex-dev        # push to the dev backend using .env.dev"
	@echo "make convex-codegen ENV=dev|prod"
	@echo "make convex-deploy     # deploy Convex backend to production using .env.prod"
	@echo "make convex-env-push ENV=dev|prod"
	@echo "make eas-env-sync ENV=dev|prod # sync EXPO_PUBLIC_* to EAS env"
	@echo "make android-arm-dev   # arm64 APK build using .env.dev values"
	@echo "make android-arm-prod  # arm64 APK build using .env.prod values"
	@echo "make catalog-import ENV=dev|prod"
	@echo "make env-show ENV=dev|prod"

env-check:
	@test -f "$(ENV_FILE)" || (echo "Missing $(ENV_FILE)"; exit 1)

env-show: env-check
	@echo "ENV=$(ENV)"
	@echo "ENV_FILE=$(ENV_FILE)"
	@echo "CONVEX_TARGET=$(CONVEX_TARGET)"
	@echo "EAS_ENV=$(EAS_ENV)"

install:
	npm install

expo: env-check
	@set -a; source "$(ENV_FILE)"; set +a; \
	REED_ENV_FILE="$(ENV_FILE)" npm start

expo-clean: env-check
	@set -a; source "$(ENV_FILE)"; set +a; \
	REED_ENV_FILE="$(ENV_FILE)" npx expo start -c

convex-dev:
	@test -f ".env.dev" || (echo "Missing .env.dev"; exit 1)
	npm run convex:dev -- --env-file .env.dev

convex-codegen: env-check
	npm run convex:codegen

convex-deploy:
	@test -f ".env.prod" || (echo "Missing .env.prod"; exit 1)
	npm run convex:deploy -- --env-file .env.prod

convex-env-push: env-check
	@test -f "$(ENV_FILE)" || (echo "Missing $(ENV_FILE)"; exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; \
	test -n "$$BETTER_AUTH_SECRET" || (echo "BETTER_AUTH_SECRET is missing in $(ENV_FILE)"; exit 1); \
	npx convex env set --deployment "$(CONVEX_TARGET)" BETTER_AUTH_SECRET "$$BETTER_AUTH_SECRET"; \
	if [ -n "$$GOOGLE_CLIENT_ID" ]; then npx convex env set --deployment "$(CONVEX_TARGET)" GOOGLE_CLIENT_ID "$$GOOGLE_CLIENT_ID"; fi; \
	if [ -n "$$GOOGLE_CLIENT_SECRET" ]; then npx convex env set --deployment "$(CONVEX_TARGET)" GOOGLE_CLIENT_SECRET "$$GOOGLE_CLIENT_SECRET"; fi; \
	if [ -n "$$SITE_URL" ]; then npx convex env set --deployment "$(CONVEX_TARGET)" SITE_URL "$$SITE_URL"; fi; \
	if [ -n "$$BETTER_AUTH_TRUSTED_ORIGINS" ]; then npx convex env set --deployment "$(CONVEX_TARGET)" BETTER_AUTH_TRUSTED_ORIGINS "$$BETTER_AUTH_TRUSTED_ORIGINS"; fi

eas-env-sync: env-check
	@set -a; source "$(ENV_FILE)"; set +a; \
	test -n "$$EXPO_PUBLIC_CONVEX_URL" || (echo "EXPO_PUBLIC_CONVEX_URL is missing in $(ENV_FILE)"; exit 1); \
	test -n "$$EXPO_PUBLIC_CONVEX_SITE_URL" || (echo "EXPO_PUBLIC_CONVEX_SITE_URL is missing in $(ENV_FILE)"; exit 1); \
	npx eas-cli env:create "$(EAS_ENV)" --name EXPO_PUBLIC_CONVEX_URL --value "$$EXPO_PUBLIC_CONVEX_URL" --visibility plaintext --scope project --force --non-interactive; \
	npx eas-cli env:create "$(EAS_ENV)" --name EXPO_PUBLIC_CONVEX_SITE_URL --value "$$EXPO_PUBLIC_CONVEX_SITE_URL" --visibility plaintext --scope project --force --non-interactive

android-arm-dev:
	@$(MAKE) eas-env-sync ENV=dev
	@set -a; source ".env.dev"; set +a; \
	REED_ENV_FILE=".env.dev" npx eas-cli build -p android -e arm64Dev

android-arm-prod:
	@$(MAKE) eas-env-sync ENV=prod
	@set -a; source ".env.prod"; set +a; \
	REED_ENV_FILE=".env.prod" npx eas-cli build -p android -e arm64Prod

catalog-import:
	npm run catalog:import -- --deployment "$(CONVEX_TARGET)"
