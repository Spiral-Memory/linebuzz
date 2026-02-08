# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-08

### Added
- **Custom Virtualization Strategy**: Implemented a custom-built virtualization strategy (inspired by TanStack) for efficient rendering and state management.
- **CodeLens & Deep Linking**: Added CodeLens support with **Deep Linking** capabilities.
- `ContextLens` service with persistent state, visibility toggle, and improved UI feedback.
- Supabase adapter for discussions and cursor-based pagination.
- Sticky ranges and git diffing capabilities.

### Changed
- Performance optimizations: debounced loading, reduced DOM overload, and smoother scrolling.

### Fixed
- Various bug fixes including scroll jitter and file casing issues.