# Implementation Plan: MeloChord 和声引擎架构升级

## Overview

This is a comprehensive architecture upgrade transforming MeloChord from an LLM-driven prototype to a constraint-based search system with LLM assistance. The implementation is organized into three parallel tracks:

1. **Backend Engine** (TypeScript，在现有 `harmony-engine/` 项目上升级): Core architecture redesign with 20+ modules
2. **Web Frontend** (TypeScript/React): Deep workbench with three-column layout
3. **Mobile Platforms** (TypeScript/React Native + WeChat Mini Program): High-frequency companion apps

## Implementation Strategy

This upgrade follows a phased approach:
- **Phase 1**: Core backend architecture (candidate lattice, global decoder, repair system)
- **Phase 2**: Enhanced analysis modules (harmonic rhythm, key sequence, phrase segmentation)
- **Phase 3**: RAG upgrades and difficulty system
- **Phase 4**: Web frontend implementation
- **Phase 5**: Mobile platform implementation
- **Phase 6**: Integration, testing, and optimization

## Task Files

Due to the massive scope (63 requirements, 20+ modules), tasks are organized into separate files:

- **[tasks-backend.md](./tasks-backend.md)**: Backend engine implementation (TypeScript，在现有 `harmony-engine/` 上升级)
  - Core architecture (candidate lattice, global decoder, LLM repositioning)
  - Harmonic rhythm prediction and phrase segmentation
  - Key sequence analysis and functional state machine
  - Three-layer repair system
  - RAG retrieval upgrades
  - Difficulty control and IR enhancements
  - Parser improvements and MusicXML output
  - OMR interface and error handling
  - Performance optimization and caching

- **[tasks-web.md](./tasks-web.md)**: Web frontend implementation (TypeScript/React)
  - Three-column workbench layout
  - Core pages (home, import, analysis workbench, review mode)
  - Project library and classroom hub
  - UI component system
  - Interactive editing and non-linear workflow
  - Explanation system and uncertainty visualization
  - Export and sharing

- **[tasks-mobile.md](./tasks-mobile.md)**: Mobile platforms implementation
  - WeChat Mini Program (TypeScript)
  - React Native App (TypeScript)
  - Scanning and OCR workflow
  - Quick fix interface
  - Cross-platform sync
  - Social sharing and classroom features

## Task Summary

- **Backend**: 30 sections, 200+ tasks covering core architecture, analysis modules, RAG upgrades, and optimization
- **Web**: 22 sections, 150+ tasks covering UI components, pages, interactions, and integrations
- **Mobile**: 24 sections, 140+ tasks covering WeChat Mini Program, React Native App, and cross-platform sync

**Total**: ~490 implementation tasks across all platforms

## Quick Start

To begin implementation:

1. **Backend developers**: Start with `tasks-backend.md` → Section 1 (Core Architecture)
2. **Web developers**: Start with `tasks-web.md` → Section 1 (Project Setup)
3. **Mobile developers**: Start with `tasks-mobile.md` → Section 1 (Platform Setup)

## Dependencies

- Backend must reach Phase 1 completion before frontend integration
- Web and mobile can develop in parallel using mock APIs
- Cross-platform sync requires both Web and mobile to be functional

## Progress Tracking

Each task file contains detailed checkboxes. Mark tasks complete as you finish them:
- `[ ]` = Not started
- `[x]` = Completed

## Notes

- All code examples in design document (Python pseudocode) are **reference implementations for algorithm logic only**, actual implementation uses TypeScript
- Follow existing `harmony-engine/` codebase patterns and conventions (TypeScript, vitest, tsup)
- Maintain backward compatibility where possible
- Write tests for all new modules (marked as optional sub-tasks)
- Document all public APIs and interfaces
