SHELL := /bin/bash
ENV ?= dev
ENV_FILE := .env.$(ENV)
CONVEX_TARGET := $(if $(filter prod production,$(ENV)),prod,dev)

.PHONY: help install expo expo-clean convex-dev convex-codegen convex-deploy convex-env-push env-check env-show

help:
	@echo "make install           # npm install"
	@echo "make expo ENV=dev      # start Expo with .env.dev"
	@echo "make expo-clean ENV=dev # start Expo with .env.dev and clear Metro cache"
	@echo "make expo ENV=prod     # start Expo with .env.prod"
	@echo "make convex-dev        # push to the dev backend using .env.dev"
	@echo "make convex-codegen ENV=dev|prod"
	@echo "make convex-deploy     # deploy Convex backend to production using .env.prod"
	@echo "make convex-env-push ENV=dev|prod"
	@echo "make env-show ENV=dev|prod"

env-check:
	@test -f "$(ENV_FILE)" || (echo "Missing $(ENV_FILE)"; exit 1)

env-show: env-check
	@echo "ENV=$(ENV)"
	@echo "ENV_FILE=$(ENV_FILE)"
	@echo "CONVEX_TARGET=$(CONVEX_TARGET)"

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
