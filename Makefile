# Drive both halves of the repository from the root: the Python backend in
# backend/ and the React frontend in frontend/.

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BACKEND := $(ROOT)/backend
FRONTEND := $(ROOT)/frontend

PYTHON ?= python3
FLAKE8 ?= $(PYTHON) -m flake8
NPM ?= npm

# PYTHONPATH lets the in-tree package import without installation.
RUNENV := PYTHONPATH=$(BACKEND)

BACKEND_APP ?= podcast_learner.app:app
BACKEND_HOST ?= 127.0.0.1
BACKEND_PORT ?= 8000

PYTEST_OPTS ?=

.PHONY: default
default: help

.PHONY: help
help:
	@echo "Backend:  pyinstall serve pytest flake8"
	@echo "Frontend: npminstall dev build vitest e2e eslint tsc"
	@echo "Both:     install test lint checktws"

# Install

.PHONY: install
install: pyinstall npminstall

.PHONY: pyinstall
pyinstall:
	$(PYTHON) -m pip install -e "$(BACKEND)[dev]"

.PHONY: npminstall
npminstall:
	cd $(FRONTEND) && $(NPM) install

# Run

.PHONY: serve
serve:
	cd $(BACKEND) && env $(RUNENV) $(PYTHON) -m uvicorn $(BACKEND_APP) \
		--reload --host $(BACKEND_HOST) --port $(BACKEND_PORT)

.PHONY: dev
dev:
	cd $(FRONTEND) && $(NPM) run dev

.PHONY: build
build:
	cd $(FRONTEND) && $(NPM) run build

# Test

.PHONY: test
test: pytest vitest

.PHONY: pytest
pytest:
	cd $(BACKEND) && env $(RUNENV) $(PYTHON) -m pytest $(PYTEST_OPTS) tests/

.PHONY: vitest
vitest:
	cd $(FRONTEND) && $(NPM) run test

.PHONY: e2e
e2e:
	cd $(FRONTEND) && $(NPM) run test:e2e

# Lint

.PHONY: lint
lint: flake8 checktws eslint tsc

.PHONY: flake8
flake8:
	@$(PYTHON) -m flake8 --version >/dev/null 2>&1 || { \
		echo "Error: flake8 not found for $(PYTHON)."; \
		echo "  Install: make pyinstall"; \
		exit 1; \
	}
	cd $(ROOT) && $(FLAKE8) backend

.PHONY: checktws
checktws:
	@git -C $(ROOT) grep --untracked -nIE '[[:blank:]]+$$' -- \
		':!frontend/package-lock.json'; \
	rc=$$?; \
	if [ $$rc -eq 0 ]; then \
		echo "Error: trailing whitespace found."; exit 1; \
	elif [ $$rc -ne 1 ]; then \
		echo "Error: git grep failed (exit $$rc)."; exit $$rc; \
	fi

.PHONY: eslint
eslint:
	cd $(FRONTEND) && $(NPM) run lint

.PHONY: tsc
tsc:
	cd $(FRONTEND) && npx tsc -b --pretty false

# vim: set ff=unix fenc=utf8 noet sw=8 ts=8 sts=8:
