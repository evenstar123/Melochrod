# Mobile Platforms Implementation Tasks

## Overview

Mobile implementation for WeChat Mini Program and React Native App, providing high-frequency companion experience.

**Programming Language**: TypeScript
**Platforms**: WeChat Mini Program, React Native (iOS/Android)
**Total Requirements**: 17 (Requirements 47-63)
**Key Features**: Scanning, quick fix, social sharing, cross-platform sync

---

## 1. Platform Setup

- [ ] 1.1 Set up WeChat Mini Program project
  - Initialize mini program with TypeScript
  - Configure app.json with pages and permissions
  - Set up folder structure: pages, components, services, utils
  - _Requirements: 47_

- [ ] 1.2 Set up React Native project
  - Initialize React Native with TypeScript
  - Configure iOS and Android projects
  - Set up folder structure: src/screens, src/components, src/services, src/hooks
  - _Requirements: 47_

- [ ] 1.3 Install shared dependencies
  - API client (axios or fetch wrapper)
  - State management (Zustand or Redux)
  - Navigation (React Navigation for RN, built-in for mini program)
  - _Requirements: 47_

- [ ]* 1.4 Set up testing frameworks
  - Jest for unit tests
  - Detox for E2E tests (React Native)
  - Mini program testing tools
  - _Requirements: 47_

## 2. Platform Positioning

- [ ] 2.1 Define mini program capabilities
  - 轻入口: quick access from WeChat
  - 轻编辑: basic editing features
  - 强分享: easy sharing to contacts/groups
  - _Requirements: 47_

- [ ] 2.2 Define app capabilities
  - 强陪伴: persistent presence
  - 强复用: project library management
  - 强练习: practice and playback features
  - _Requirements: 47_

- [ ] 2.3 Implement capability matrix
  - Document which features are available on which platform
  - Mini program: scanning, quick view, sharing, classroom quick access
  - App: full project library, practice mode, offline access, notifications
  - _Requirements: 47_


## 3. Visual System

- [ ] 3.1 Adapt Web visual system for mobile
  - Use same color palette (warm paper, cyan-indigo, vermillion/amber)
  - Lighter, more direct design
  - More whitespace
  - Larger, clearer controls
  - _Requirements: 48_

- [ ] 3.2 Implement iOS-specific design
  - Use translucent materials
  - Use card floating layers
  - Follow iOS Human Interface Guidelines
  - _Requirements: 48_

- [ ] 3.3 Implement Android-specific design
  - Adapt Material Design 3
  - Support dynamic colors
  - Clear hierarchy
  - Natural motion curves
  - _Requirements: 48_

- [ ] 3.4 Implement card-based data summaries
  - Design compact info cards
  - Use icons and badges
  - _Requirements: 48_

## 4. Navigation Structure

- [ ] 4.1 Implement bottom navigation (4 tabs)
  - 首页 (Home)
  - 项目 (Projects)
  - 扫描 (Scan)
  - 我的 (Me)
  - _Requirements: 49_

- [ ] 4.2 Add practice card to app home
  - Show practice tasks
  - Quick access to practice mode
  - _Requirements: 49_

- [ ] 4.3 Add classroom card to mini program home (teacher version)
  - Show classroom tasks
  - Quick access to assignments
  - _Requirements: 49_

- [ ] 4.4 Implement notification badges
  - Show unread count on tabs
  - _Requirements: 49_

- [ ] 4.5 Follow platform conventions
  - iOS: tab bar at bottom
  - Android: bottom navigation
  - Mini program: tabBar in app.json
  - _Requirements: 49_

## 5. Mobile Home Page

- [ ] 5.1 Implement "Continue last project" card
  - Show thumbnail and title
  - Click to resume at last position
  - _Requirements: 50_

- [ ] 5.2 Implement "Scan now" button
  - Large, prominent button
  - Direct to camera
  - _Requirements: 50_

- [ ] 5.3 Implement recent imports list
  - Show last 5 imports
  - Swipe to delete
  - _Requirements: 50_

- [ ] 5.4 Implement "Today's pending" summary
  - Show count of pending confirmations
  - Click to go to review mode
  - _Requirements: 50_

- [ ] 5.5 Implement classroom/practice tasks
  - Show based on user role
  - _Requirements: 50_

- [ ] 5.6 Implement favorites quick access
  - Show favorite templates
  - _Requirements: 50_

- [ ] 5.7 Implement pull-to-refresh
  - Sync latest data
  - _Requirements: 50_

- [ ]* 5.8 Write home page tests
  - Test card rendering
  - Test navigation
  - _Requirements: 50_


## 6. Scan Page

- [ ] 6.1 Implement camera interface
  - Show camera viewfinder
  - Support photo capture
  - Support album selection
  - Support WeChat file selection (mini program)
  - _Requirements: 51_

- [ ] 6.2 Implement auto-detection
  - Toggle for auto edge detection
  - Show detected edges overlay
  - _Requirements: 51_

- [ ] 6.3 Implement multi-page capture
  - Capture multiple pages in sequence
  - Show thumbnails after each capture
  - Support drag to reorder
  - Support delete and retake
  - _Requirements: 51_

- [ ] 6.4 Implement quality guidance
  - Show tips for better capture (lighting, angle)
  - Detect low quality and warn
  - _Requirements: 51_

- [ ] 6.5 Implement processing progress
  - Show "正在识别第 X/Y 页"
  - Show stage-based progress
  - _Requirements: 51_

- [ ] 6.6 Implement real-time edge detection
  - Detect page edges in camera preview
  - Auto-crop to page boundaries
  - _Requirements: 51_

- [ ]* 6.7 Write scan page tests
  - Test camera access
  - Test multi-page capture
  - Test quality detection
  - _Requirements: 51_

## 7. Mobile Project Page

- [ ] 7.1 Implement project card list
  - Show thumbnail, title, status
  - Show recent status, low-confidence count
  - Show export status, classroom feedback status
  - _Requirements: 52_

- [ ] 7.2 Implement filtering
  - Filter by status, time, difficulty
  - _Requirements: 52_

- [ ] 7.3 Implement long-press multi-select
  - Enter multi-select mode on long press
  - Show checkboxes
  - Batch operations toolbar
  - _Requirements: 52_

- [ ] 7.4 Implement swipe actions
  - Swipe left: share, delete, archive
  - _Requirements: 52_

- [ ] 7.5 Implement sync status
  - Show sync indicator (已同步/同步中/冲突)
  - _Requirements: 52_

- [ ]* 7.6 Write project page tests
  - Test card display
  - Test filtering
  - Test swipe actions
  - _Requirements: 52_

## 8. Mobile Result Page

- [ ] 8.1 Implement summary card (first screen)
  - Show key, recommended difficulty
  - Show low-confidence count
  - One-tap play button
  - One-tap export/share button
  - _Requirements: 53_

- [ ] 8.2 Implement scrollable score preview
  - Show thumbnail strip
  - Swipe to navigate
  - _Requirements: 53_

- [ ] 8.3 Implement full score view (scroll down)
  - Show complete score
  - Show numbered notation option
  - Show chord list
  - _Requirements: 53_

- [ ] 8.4 Implement measure interactions
  - Single tap: highlight and show bottom sheet with candidates
  - Double tap: play measure
  - Long press: add to "稍后处理"
  - _Requirements: 53_

- [ ] 8.5 Implement pinch-to-zoom
  - Support zoom in/out
  - _Requirements: 53_

- [ ] 8.6 Implement horizontal swipe navigation
  - Swipe to next/previous pending measure
  - _Requirements: 53_

- [ ]* 8.7 Write result page tests
  - Test summary display
  - Test measure interactions
  - _Requirements: 53_


## 9. Quick Fix Page

- [ ] 9.1 Implement bottom sheet for candidates
  - Show on measure tap
  - Display top-3 candidates
  - Swipe left/right to see alternatives
  - _Requirements: 54_

- [ ] 9.2 Implement "Why" explanation
  - Swipe up to see explanation
  - Show function, melody relation, alternatives
  - _Requirements: 54_

- [ ] 9.3 Implement auto-navigation
  - After confirmation, auto-jump to next pending
  - Show progress: "已确认 X/Y 处"
  - _Requirements: 54_

- [ ] 9.4 Implement skip and defer
  - "跳过" button
  - "稍后处理" button
  - _Requirements: 54_

- [ ] 9.5 Implement completion celebration
  - Show animation when all confirmed
  - Show summary
  - _Requirements: 54_

- [ ]* 9.6 Write quick fix tests
  - Test bottom sheet
  - Test auto-navigation
  - Test completion flow
  - _Requirements: 54_

## 10. Settings Page

- [ ] 10.1 Implement preference settings
  - Default difficulty
  - Common style
  - Common export format
  - Preferred explanation depth
  - _Requirements: 55_

- [ ] 10.2 Implement classroom/workspace entry
  - Link to classes
  - Link to collaboration spaces
  - _Requirements: 55_

- [ ] 10.3 Implement favorite templates
  - Show recent favorites
  - Quick access
  - _Requirements: 55_

- [ ] 10.4 Implement account info
  - Show user profile
  - Show sync status
  - _Requirements: 55_

- [ ] 10.5 Implement "Process once, don't save" toggle
  - Option for temporary processing
  - _Requirements: 55_

- [ ] 10.6 Implement usage statistics
  - Show this week's analysis count
  - Show correction count
  - Show common harmony templates
  - _Requirements: 55_

- [ ] 10.7 Implement privacy and data management
  - Clear privacy statement
  - Data management entry
  - _Requirements: 55_

- [ ]* 10.8 Write settings page tests
  - Test preference updates
  - Test statistics display
  - _Requirements: 55_

## 11. Onboarding Flow

- [ ] 11.1 Implement mini program first entry
  - Show 3 large buttons:
    - 拍一页试试
    - 从微信文件打开
    - 看一首示例
  - _Requirements: 56_

- [ ] 11.2 Implement app first entry
  - Ask role: 我是老师 / 我是学习者/创作者
  - Adjust recommendations by role
  - Don't lock features
  - _Requirements: 56_

- [ ] 11.3 Avoid carousel tutorials
  - Use contextual hints instead
  - _Requirements: 56_

- [ ] 11.4 Implement first success hints
  - Light tooltip for key features
  - _Requirements: 56_

- [ ] 11.5 Implement skip option
  - Allow skip onboarding
  - _Requirements: 56_

- [ ]* 11.6 Write onboarding tests
  - Test first entry flow
  - Test role selection
  - _Requirements: 56_


## 12. Scan Interaction

- [ ] 12.1 Implement 4-step scan flow
  - Step 1: 取图 (capture/select)
  - Step 2: 识别页边 (detect edges)
  - Step 3: 选择继续加页或完成 (add more or finish)
  - Step 4: 进入分析 (start analysis)
  - _Requirements: 57_

- [ ] 12.2 Implement per-page feedback
  - Show thumbnail immediately after capture
  - _Requirements: 57_

- [ ] 12.3 Implement page management
  - Drag to reorder
  - Delete and retake
  - _Requirements: 57_

- [ ] 12.4 Implement analysis progress
  - Show "正在识别第 X/Y 页"
  - Show stage progress
  - _Requirements: 57_

- [ ] 12.5 Implement cancellation
  - Support cancel long tasks
  - _Requirements: 57_

- [ ]* 12.6 Write scan interaction tests
  - Test 4-step flow
  - Test page management
  - _Requirements: 57_

## 13. UI Hierarchy

- [ ] 13.1 Implement bottom sheet for quick actions
  - Use for: chord replacement, view reason, export format selection
  - Support drag to adjust height
  - Support swipe down to close
  - _Requirements: 58_

- [ ] 13.2 Implement full-screen pages for deep work
  - Use for: long review sessions, multi-measure editing, classroom annotation
  - Provide clear back button
  - _Requirements: 58_

- [ ] 13.3 Follow platform conventions
  - iOS: use sheet presentation
  - Android: use bottom sheet
  - _Requirements: 58_

- [ ]* 13.4 Write UI hierarchy tests
  - Test bottom sheet behavior
  - Test full-screen navigation
  - _Requirements: 58_

## 14. Practice Mode (App Only)

- [ ] 14.1 Implement auto-playback
  - Play current chord progression
  - Highlight current measure
  - _Requirements: 59_

- [ ] 14.2 Implement view toggles
  - Toggle: 只看和弦 / 只看简谱 / 只看功能
  - _Requirements: 59_

- [ ] 14.3 Implement favorites
  - "这版我喜欢" button
  - Add to favorites
  - _Requirements: 59_

- [ ] 14.4 Implement practice list
  - Add to practice list
  - _Requirements: 59_

- [ ] 14.5 Implement playback controls
  - Adjust speed
  - Loop playback
  - _Requirements: 59_

- [ ] 14.6 Implement practice history
  - Track practice sessions
  - Show progress
  - _Requirements: 59_

- [ ]* 14.7 Write practice mode tests
  - Test playback
  - Test view toggles
  - Test favorites
  - _Requirements: 59_

## 15. Social Sharing (Mini Program)

- [ ] 15.1 Implement share card generation
  - Create summary card with piece info and preview
  - _Requirements: 60_

- [ ] 15.2 Implement share to contacts/groups
  - Use WeChat share API
  - Recipient can open read-only version
  - _Requirements: 60_

- [ ] 15.3 Implement assignment link generation
  - Teacher creates assignment link
  - Student opens from link to piece and instructions
  - _Requirements: 60_

- [ ] 15.4 Implement light feedback
  - "我已确认" / "我有疑问" buttons
  - _Requirements: 60_

- [ ] 15.5 Implement group discussion
  - Support quick comments in group
  - _Requirements: 60_

- [ ] 15.6 Implement teacher dashboard
  - View student open and completion status
  - _Requirements: 60_


- [ ]* 15.7 Write social sharing tests
  - Test share card generation
  - Test link opening
  - _Requirements: 60_

## 16. Privacy and Permissions

- [ ] 16.1 Implement just-in-time permission requests
  - Don't request all permissions on entry
  - Request camera when user taps "拍照"
  - Request album when user taps "从相册导入"
  - _Requirements: 61_

- [ ] 16.2 Implement first upload explanation
  - Show simple card before first upload
  - Explain: what's uploaded, purpose, storage rules, can delete
  - _Requirements: 61_

- [ ] 16.3 Implement "Process once, don't save" toggle
  - Explicit toggle for temporary processing
  - _Requirements: 61_

- [ ] 16.4 Implement privacy settings
  - Clear privacy statement in settings
  - Data management entry
  - _Requirements: 61_

- [ ] 16.5 Implement data viewing and deletion
  - User can view all uploaded data
  - User can delete data
  - _Requirements: 61_

- [ ] 16.6 Follow platform privacy guidelines
  - Comply with WeChat mini program privacy rules
  - Comply with iOS App Store privacy requirements
  - Comply with Android privacy requirements
  - _Requirements: 61_

- [ ]* 16.7 Write privacy tests
  - Test permission requests
  - Test data deletion
  - _Requirements: 61_

## 17. Cross-Platform Sync

- [ ] 17.1 Implement real-time sync
  - Sync project data across devices
  - Sync correction history
  - Sync preferences
  - _Requirements: 62_

- [ ] 17.2 Implement position memory
  - Remember last position on each device
  - Resume at correct position
  - _Requirements: 62_

- [ ] 17.3 Implement cross-device workflows
  - Support "手机上拍，Web 端深修"
  - Support "Web 导出前，手机上快速复核"
  - _Requirements: 62_

- [ ] 17.4 Implement conflict resolution
  - Detect conflicts
  - Provide version selection UI
  - _Requirements: 62_

- [ ] 17.5 Implement sync status display
  - Show sync status indicator
  - Show last sync time
  - _Requirements: 62_

- [ ] 17.6 Implement offline editing
  - Support offline edits
  - Auto-sync when online
  - _Requirements: 62_

- [ ]* 17.7 Write sync tests
  - Test real-time sync
  - Test conflict resolution
  - Test offline editing
  - _Requirements: 62_

## 18. Dependency Mechanisms

- [ ] 18.1 Implement "Continue unfinished" auto-resume
  - Auto-navigate to last unprocessed low-confidence measure
  - _Requirements: 63_

- [ ] 18.2 Implement personal style memory
  - Remember user's accepted harmony colors
  - Remember preferred explanation depth
  - _Requirements: 63_

- [ ] 18.3 Implement mobile favorites
  - Quick access to common accompaniment templates
  - Quick access to classroom examples
  - Quick access to satisfactory versions
  - _Requirements: 63_

- [ ] 18.4 Implement practice list
  - Convert analysis results to practice materials
  - _Requirements: 63_

- [ ] 18.5 Implement classroom notifications
  - Push notification for new teacher comments
  - Push notification for new student submissions
  - _Requirements: 63_

- [ ] 18.6 Implement weekly recap
  - Auto-generate weekly summary
  - Show: pieces analyzed, corrections made, common templates
  - _Requirements: 63_


- [ ] 18.7 Implement global search
  - Search by title, key, chord, teacher notes, student name
  - _Requirements: 63_

- [ ]* 18.8 Write dependency mechanism tests
  - Test auto-resume
  - Test style memory
  - Test notifications
  - _Requirements: 63_

## 19. API Integration

- [ ] 19.1 Implement API client
  - Create API client with base URL
  - Handle authentication
  - Handle network errors
  - _Requirements: 47-63_

- [ ] 19.2 Implement harmony analysis API
  - POST /api/harmonize with image/MusicXML
  - Handle multipart upload for images
  - _Requirements: 51_

- [ ] 19.3 Implement project APIs
  - GET /api/projects (list)
  - GET /api/projects/:id (detail)
  - PUT /api/projects/:id (update)
  - _Requirements: 52_

- [ ] 19.4 Implement edit APIs
  - POST /api/projects/:id/measures/:index/chord
  - GET /api/projects/:id/measures/:index/alternatives
  - _Requirements: 54_

- [ ] 19.5 Implement sync APIs
  - GET /api/sync/status
  - POST /api/sync/push
  - GET /api/sync/pull
  - _Requirements: 62_

- [ ] 19.6 Implement classroom APIs (mini program)
  - GET /api/classes/:id/assignments
  - POST /api/submissions
  - _Requirements: 60_

- [ ]* 19.7 Write API integration tests
  - Test API calls
  - Test error handling
  - _Requirements: 47-63_

## 20. State Management

- [ ] 20.1 Implement project store
  - Store current project
  - Store chord sequence
  - Actions: load, update
  - _Requirements: 52_

- [ ] 20.2 Implement UI store
  - Store view mode
  - Store selected measures
  - Store bottom sheet state
  - _Requirements: 53_

- [ ] 20.3 Implement user store
  - Store user profile
  - Store preferences
  - Store recent projects
  - _Requirements: 55_

- [ ] 20.4 Implement sync store
  - Store sync status
  - Store pending changes
  - _Requirements: 62_

- [ ]* 20.5 Write state management tests
  - Test store actions
  - Test state updates
  - _Requirements: 47-63_

## 21. Platform-Specific Features

- [ ] 21.1 Implement WeChat mini program specific features
  - WeChat login
  - WeChat file picker
  - WeChat share API
  - Mini program lifecycle hooks
  - _Requirements: 47, 60_

- [ ] 21.2 Implement React Native specific features
  - Push notifications (iOS/Android)
  - Offline storage (AsyncStorage)
  - Camera access (react-native-camera)
  - File system access
  - _Requirements: 47, 59_

- [ ] 21.3 Implement iOS specific features
  - Face ID / Touch ID (optional)
  - iOS share sheet
  - iOS notifications
  - _Requirements: 47_

- [ ] 21.4 Implement Android specific features
  - Biometric authentication (optional)
  - Android share intent
  - Android notifications
  - _Requirements: 47_

- [ ]* 21.5 Write platform-specific tests
  - Test WeChat APIs
  - Test native modules
  - _Requirements: 47_


## 22. Performance Optimization

- [ ] 22.1 Implement image optimization
  - Compress images before upload
  - Use appropriate image formats
  - _Requirements: 51_

- [ ] 22.2 Implement lazy loading
  - Load project thumbnails on demand
  - Load score images progressively
  - _Requirements: 52_

- [ ] 22.3 Implement caching
  - Cache API responses
  - Cache rendered scores
  - Cache user preferences
  - _Requirements: 47_

- [ ] 22.4 Implement offline support
  - Cache essential data for offline use
  - Queue operations when offline
  - Sync when back online
  - _Requirements: 62_

- [ ]* 22.5 Write performance tests
  - Test load time
  - Test memory usage
  - _Requirements: 47_

## 23. Testing and Quality Assurance

- [ ] 23.1 Write unit tests for components
  - Test all major components
  - Test state management
  - _Requirements: 47-63_

- [ ] 23.2 Write integration tests
  - Test complete user flows
  - Test API integration
  - _Requirements: 47-63_

- [ ] 23.3 Test on real devices
  - Test on iOS devices (iPhone, iPad)
  - Test on Android devices (various manufacturers)
  - Test WeChat mini program on WeChat app
  - _Requirements: 47_

- [ ] 23.4 Test different screen sizes
  - Test on small phones
  - Test on large phones
  - Test on tablets
  - _Requirements: 47_

- [ ] 23.5 Test network conditions
  - Test on slow network
  - Test offline mode
  - Test network interruption
  - _Requirements: 62_

- [ ] 23.6 Test permissions
  - Test camera permission flow
  - Test album permission flow
  - Test notification permission flow
  - _Requirements: 61_

## 24. Checkpoint - Mobile Platforms Complete

- [ ] 24. Ensure all mobile tests pass
  - Run all unit tests
  - Run all integration tests
  - Test on iOS devices
  - Test on Android devices
  - Test WeChat mini program
  - Test cross-platform sync
  - Fix any failing tests
  - Ask the user if questions arise

---

## Notes

- All tasks reference specific requirements from requirements.md
- Optional tasks (marked with *) are testing tasks that can be skipped for faster MVP
- Follow platform-specific design guidelines (iOS HIG, Material Design, WeChat Mini Program Design)
- Ensure consistent experience across platforms while respecting platform conventions
- Test on real devices, not just simulators/emulators
- Pay special attention to performance on lower-end devices
- Ensure privacy compliance for all platforms
