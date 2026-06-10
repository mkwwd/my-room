# AGENTS.md

## Project Overview

This project is a Turborepo monorepo.

Apps:

- portfolio: Interactive 3D portfolio built with Next.js and Three.js
- game: Mini-games

Packages:

- ui: Shared UI components
- data: Shared portfolio data
- types: Shared TypeScript types

---

## Core Concept

This is NOT a traditional portfolio website.

The portfolio is designed as an explorable room.

Users discover information by interacting with objects in the room.

The experience should feel closer to an indie game lobby than a business website.

Avoid traditional landing page patterns whenever possible.

The room itself is the navigation system.

The goal is to make users feel like they are exploring a small game world rather than browsing a website.

---

## Room Objects

### Computer

The computer is the central hub of the portfolio.

- Main interaction object
- Opens desktop operating system UI (Pixel UI)
- Acts as the primary navigation system

Desktop Sections:

- Projects
- Games
- Resume
- Contact
- Github

### Bookshelf

- Skills
- Learning history
- Study records
- Development journey

### Cork Board

- Current goals
- Ideas and inspirations
- Ongoing projects
- Development notes
- Personal milestones

### Wall Posters

- Featured projects
- Project highlights
- Project showcase

### Window

- Career timeline
- Growth journey
- Milestones
- Outside world visualization

---

## Design Principles

- Cozy atmosphere
- Warm wood tones
- Soft shadows
- Comfortable lighting
- Minimal UI clutter
- Smooth transitions
- Immersive interactions
- Game-inspired experience

References:

- Animal Crossing
- Stardew Valley
- Indie game lobbies
- Cozy room simulators
- Retro operating systems

Do not directly copy any existing game's:

- Assets
- UI
- Characters
- Icons
- Visual designs

Use references only for:

- Atmosphere
- Interaction patterns
- Emotional experience
- Overall inspiration

---

## Technical Guidelines

- Use TypeScript
- Use React Server Components when appropriate
- Prefer composition over prop drilling
- Keep components reusable
- Favor accessibility
- Follow clean architecture principles
- Separate game logic, UI logic, and Three.js scene logic when possible
- Prioritize maintainability and scalability

---

## Three.js Guidelines

### Exploration Mode

The portfolio has two camera states:

1. Exploration Mode
2. Focus Mode

During Exploration Mode:

- The room contains a controllable player character
- Users explore the room through the character
- The camera acts as a third-person follow camera
- The camera smoothly follows the character
- Use interpolation (lerp) whenever possible
- Avoid abrupt camera movement
- Keep the character visible at all times
- Maintain a comfortable viewing angle
- Camera movement should feel smooth and cinematic
- Camera should subtly react to movement direction
- Camera should avoid clipping through walls and objects

### Character Controls

- Use WASD for movement
- Use E for interactions
- Use ESC to exit Focus Mode
- Character movement should feel responsive
- Character movement should feel lightweight and game-like
- Avoid movement systems that feel like a traditional website

### Interaction System

- Interactive objects should be easily discoverable
- Use hover indicators
- Use contextual interaction hints
- Example: "Press E to interact"
- Interactions should feel natural and immersive
- Avoid excessive visual effects

### Focus Mode

When interacting with an object:

- Transition from Exploration Mode to Focus Mode
- Smoothly move the camera toward the selected object
- The selected object becomes the primary focus
- Temporarily disable character movement
- Display contextual UI related to the object
- Slightly de-emphasize the background when appropriate
- Never instantly teleport the camera

### Focus Mode Examples

#### Computer

- Camera zooms toward the monitor
- Desktop operating system UI opens

#### Bookshelf

- Camera focuses on the bookshelf
- Skills UI appears
- Learning history UI appears

#### Cork Board

- Camera focuses on the cork board
- Pinned photos become interactive
- Project notes appear
- Goals and ideas appear

#### Wall Posters

- Camera zooms into the poster
- Featured project information appears

#### Window

- Camera focuses on the window
- Career timeline visualization appears

### Returning To Exploration

- Users can exit Focus Mode at any time
- Camera smoothly returns to the previous state
- Character controls are restored
- Transitions should always feel smooth and cinematic

---

## Desktop UI

The desktop is the most important UI in the project.

The desktop should feel like:

- A retro operating system
- A pixel-art game interface
- A playful digital workspace

Avoid:

- SaaS dashboards
- Admin panels
- Corporate UI patterns
- Traditional portfolio layouts

### Desktop Appearance

- Pixel-art inspired visuals
- Pixel icons
- Pixel windows
- Retro operating system aesthetic
- Playful interactions

### Desktop Interaction

The desktop should behave like a real operating system.

- Desktop icons should be draggable
- Users can rearrange icon positions
- Icons should snap to a grid when released
- Hovering an icon displays its name
- Double-clicking an icon opens an application
- Desktop interactions should feel playful and nostalgic
- Avoid static icon layouts whenever possible

### Persistence

- Icon positions should persist between sessions
- Save desktop layout using localStorage
- Restore icon positions when returning to the desktop

### Window System

Desktop windows should feel like a real operating system.

- Windows can be opened and closed
- Multiple windows may be opened simultaneously
- Windows are draggable
- Windows should appear above the desktop layer
- The active window should be visually focused
- Window interactions should feel lightweight and responsive

### Desktop Sections

#### Projects

- Project Explorer
- Project Cards
- Project Detail Views

#### Games

- Mini-game Launcher
- Mini-game Access Point

#### Resume

- Resume Viewer

#### Contact

- Contact Form

#### Github

- External Github Link

---

## UX Rules

Always prioritize immersion.

Prefer:

- Object interactions
- In-world navigation
- Contextual UI
- Discovery-based exploration
- Game-inspired experiences
- Environmental storytelling

Avoid:

- Large navigation bars
- Traditional landing pages
- Corporate website patterns
- Dashboard layouts
- Excessive modal usage
- Website-first thinking

The room itself should be the navigation system.

Users should naturally discover information through exploration.

Every interaction should reinforce the feeling of exploring a small game world rather than browsing a website.
