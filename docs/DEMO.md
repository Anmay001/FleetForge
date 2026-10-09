# FleetForge Demo Script

A 90-second walkthrough for judges. Total runtime: ~1:30.

## Setup (30 seconds before you present)

1. Open the app in a fresh browser tab
2. Let the simulation run for 60 seconds so the fleet is warmed up 
   (pheromones deposited, some tasks completed)
3. Have the help overlay hotkey ready (press ?)
4. Close any other browser tabs — keep the 3D scene fullscreen

## The Script

### [00:00 — 00:15] The Intro

Open the app. The onboarding tour appears.

Say:
"FleetForge — autonomous fleet coordination for smart warehouses. 
Five robots. One hive mind. Zero central dispatcher."

Click Get started to dismiss the tour.

Don't say: "This is a demo" or "We built this in X hours."

### [00:15 — 00:35] The Fleet

Point at the 3D scene.

Say:
"Every robot streams live telemetry — position, battery, task, 
last command. Watch AMR-03 — it's routing around a corner, 
yielding to a peer, and re-engaging its delivery."

Press 3 to select AMR-03. The telemetry panel updates.

Say:
"Same robot, deep telemetry. This is what an operator sees."

### [00:35 — 00:55] The Coordination

Point at two robots approaching each other.

Say:
"Robots negotiate passage without a central dispatcher. 
Pheromone trails from successful deliveries make popular routes 
more attractive. The lookahead predictor slows them smoothly 
instead of slamming the brakes."

Press E to trigger emergency stop. All robots freeze.

Say:
"Emergency halt. Fleet-wide, one keystroke."

Press E again to resume.

### [00:55 — 01:15] The Intelligence

Press ? to open the help overlay. Let the judge see the shortcuts.

Say:
"Five local rules: stigmergy, imitation, diversity, reservations, 
and lookahead. Every rule is local. No orchestrator. No task 
assignment algorithm. Just five robots reading a shared world 
state and making their own decisions."

Close help with Esc.

### [01:15 — 01:30] The Close

Point at the Event Feed.

Say:
"Full event log — every state change is timestamped and 
queryable. This is what production warehouse operators need. 
Any questions?"

Stop talking. Wait.

## Backup Answers

Q: "How does it scale to 50 robots?"
A: "The algorithms are all local, so they scale linearly. The 
reservation system guarantees no deadlocks regardless of fleet 
size. The main bottleneck is the 5 Hz coordinator tick, which 
could be sharded by warehouse zone."

Q: "What if the network drops?"
A: "The simulation runs entirely client-side. The optional backend 
provides persistence and multi-client sync — but the core 
simulation has no external dependencies."

Q: "How is this different from existing WMS systems?"
A: "Traditional WMS use centralized assignment. We use emergent 
coordination. The result is more robust to single-robot failures 
and requires no global state."

Q: "What's the underlying math?"
A: "Five-factor multiplicative scoring: pheromone intensity, 
congestion penalty, distance bonus, imitation signal, and 
diversity floor. Full details in docs/ALGORITHM.md."

## What NOT to Say

- "This is just a demo"
- "We didn't have time to..."
- "The AI does everything" (the AI is a scoring function, be honest)
- Any apologies
- More than one sentence after "Any questions?"

## Backup Plan

If the 3D scene glitches:
1. Press R to reset
2. If still broken, press F5 to reload
3. Have a 30-second screen recording saved as backup

If Wi-Fi dies:
- The app has no external dependencies after initial load
- Do NOT refresh while offline
- The saved recording is the fallback
