# Game brief (verbatim)

The prompt I pasted on 2026-11-01 to start building the game. The first line is a role instruction to the coding agent. Only the leading indentation was removed.

---

You are an expert full-stack developer, 3D graphics specialist, and creative game designer.

### THE MISSION
Build a modern, browser-based, 3D multi-agent simulation game where distinct AI characters sit together in a chamber to
debate, deliberate, and solve high-stakes scenarios in real time.

The application must run smoothly in the browser (using Three.js / WebGL) with an intuitive, polished, and delightful user
experience. You have full creative freedom over the visual theme, art direction, and aesthetic flavor (e.g., Cyberpunk
High-Rise Boardroom, Ancient Arcane Wizard Conclave, Deep-Space Orbital Habitat, 1960s Retro Mission Control, or Solarpunk
Council).

---

### CORE INVARIANTS (The Non-Negotiables)

1. **Multiple Distinct AI Personas (4–6 Seated Characters):**
   - Each character has an authentic personality, moral alignment, voice/speaking style, and role.
   - **Strict Persona Immersion:** Agents are 100% in-character. They never say "As an AI..." or break the fourth wall.
   They speak naturally in conversational turns (2–3 punchy sentences).

2. **Private Cognitive Memory Stream (Dual-Channel Cognition):**
   - Each agent has an individual memory stream tracking:
     - **Episodic buffer:** What happened at the table and who said what.
     - **Private Inner Thoughts / Stance:** An internal monologue and current conviction that may differ from their polite
     public rhetoric.
     - **Peer Trust / Affinity:** How much they agree with or distrust each fellow council member.

3. **Dynamic Scenarios & High-Stakes Dilemmas:**
   - The council deliberates over an urgent dilemma (e.g., emergency resource rationing, first contact protocols,
   containment breaches, political treaties).
   - Pre-loaded scenarios plus an easy way for the user to type in their own custom prompt/dilemma.

4. **Player Interventions (The "God" / "Moderator" Levers):**
   - **Moderator Gavel:** Speak directly as the Council Chair to call order, ask questions, or redirect debate.
   - **Crisis Shock / Event Injection:** Trigger mid-debate emergency alerts that force the room to react to new
   variables.
   - **Confidential Whisper (Idea Implantation):** Secretly inject an idea or hidden piece of intel into *one* specific
   agent’s subconscious mind, watching them organically champion it at the table without revealing they were prompted.
   - **Call for Vote / Consensus:** Call a formal binding vote where each character casts their ballot with a brief
   rationale.

5. **Smooth 3D Browser Presence (Three.js):**
   - A circular or amphitheater arrangement around a central table or holographic centerpiece.
   - Embodied characters with procedural visual life: idle breathing, head-tracking toward whoever is speaking, active
   speaker lighting/glows, and overhead nameplates with status indicators.
   - Smooth cinematic camera transitions (Overview, Auto-focus on active speaker, Free orbit).
