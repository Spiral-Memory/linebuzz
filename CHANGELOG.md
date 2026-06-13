# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2026-06-13

### Added
- Added custom setup card UI for self-hosted server configuration.

### Changed
- Improved segment diff fallback behavior to display the full file.

### Fixed
- Fixed command/character input consumption for the macOS `option+b` shortcut.

## [0.3.2] - 2026-06-10

### Fixed
- Fixed line out-of-bounds error on shortened files.
- Fixed jump to chat button not focusing the closed chat panel.
- Added disposal of Slack connection listener on webview close.

## [0.3.1] - 2026-06-07

### Fixed
- Addressed the issue where multiple teams with the same Slack channel would cause errors in the integration.

## [0.3.0] - 2026-06-06

### Added
- **Slack Integration**: Added Slack connection options, channel configuration, and support for syncing messages and threads directly with Slack.
- **Thread Support**: Introduced threaded conversation support with dedicated side panels and message jump navigation.
- **Custom Server Environments**: Added support for connecting to self-hosted custom server instances with automatic configuration checks.
- **Client Compatibility Check**: Added automatic validation checks to ensure the local extension matches the host server version.
- **Improved Code Staging**: Added support for attaching multiple code snippets to messages with improved real-time tracking of code ranges.
- **Redesigned Auth Flow**: Consolidated login paths into a unified authentication process with native progress indicators.
- **UI & UX Improvements**: Added page loader indicators, open-in-ide redirection views, landing page view, and error boundaries for improved stability.

### Changed
- Standardized security configuration names across client and adapter files.

### Fixed
- Fixed authentication cache issues.
- Fixed code reference navigation inaccuracies during file-edit shifts.
- Fixed scrolling layout glitches and improved mobile view responsiveness.

## [0.2.1] - 2026-02-09

### Fixed
- Fixed navigator bug.

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