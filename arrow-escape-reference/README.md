# Arrow Escape - Vertical Slice

A highly optimized, data-driven vertical slice of a hyper-casual puzzle game, developed for the Miniclip Technical Assessment.

> **Note:** This README was updated post-submission to outline the exact development timeline and clarify the AI collaboration process.

## Delivery Overview

**Engine:** Unity 6000.3.13f1 LTS  
**Timeline:** ~5.5 hours of active development (over a 7-hour window)

### How to Play

1. Open the scene `ArrowEscape` located in `_Project/Scenes/`.
2. Set Game View aspect ratio to **9:16** (or 1080x1920).
3. Confirm all parent GameObjects are active except `[Editor Level Builder]`.
4. Press Play.

### Implemented Feature Set

* **Event-Driven Architecture:** Uses ScriptableObject-based Events to completely decouple systems. The UI, Game Logic, and Input layers function independently without hard references to one another.
* **Zero-GC Grid Simulation & Object Pooling:** Mathematical grid coordinate mapping replaces heavy physics colliders for O(1) performance. Arrows are instantiated once via a custom Object Pool and recycled using Action callbacks, completely eliminating Garbage Collection spikes during gameplay.
* **Data-Oriented Level Baking:** A fully functional custom Editor tool allows for visual puzzle authoring, which is then baked down into pure mathematical data (`LevelDataSO`) to bypass scene-heavy prefab serialization.
* **Look-Ahead Pathing:** Arrows validate their entire exit path instantly using virtual raycasts, playing localized bump animations if blocked without the need for complex state-caching or rollback logic.

### Iteration & Versioning

The earliest playable build consisted of a single level, built with the level editor already (`Level_01`). Arrows used Unity Physics `BoxCollider2D` to detect clicks (only in the arrow's head), and movement was instantaneous, teleporting one grid space at a time without animation when clicked. There was no UI, camera scaling, or level progression.

**What was added after that:**
* Replaced physical raycasts with mathematical coordinate mapping for input, allowing the full extent of the arrow to be pressed.
* Implemented coroutine-based smooth gliding and the whole-snake LineRenderer update.
* Built the `GameManager` logic to sequence multiple levels and get an MVP gameplay-loop.
* Developed the dynamic camera scaling.
* Wrote the Event-Driven UI system and menu flows.
* Extracted magic numbers into the `GameSettingsSO` for designer tuning.

### Trade-offs & Scope Decisions

* **Data-Oriented Level Baking:** *Trade-off:* Instead of instantiating prefabs in a scene, I chose to bake levels into `LevelDataSO` (ScriptableObjects). This requires a custom Editor tool to build levels, but drastically reduces runtime memory and loading times. I debated on the visual level editor for some time, thinking it would take up too much time to develop, but it didnt. And looking back, I wouldn't have done it any other way, because manually typing coordinates or text maps would be harder to visualize and more time consuming.
* **"Look-Ahead" Pathing:** *Trade-off:* Instead of allowing an arrow to move into the distance, physically collide, and then "rewind" its tail, I implemented a virtual raycast. Arrows validate their entire exit path instantly. If blocked, they play a localized "bump" animation. This saves massive state-caching overhead and feels punchier for a hyper-casual game.
* **UI Panels:** For this project I used an abstract UI Panel, which is overkill and not necessary in a vertical slice, since the UI panels barely had any interactions, leading to empty dedicated panel scripts, that simply inherited. However, it's a script that I like to use in my Unity projects, and bringing it in cost me no time at all and showcases the possibilities of easily expanding the game's UI.

### What I Deliberately Chose Not to Do

* **In-Game HUD:** I deliberately chose not to include a runtime HUD or restart button in favor of a cleaner, hyper-casual aesthetic, focusing strictly on the Main Menu and End Screen loops.
* **Tail Reversal/Backtracking:** As mentioned above, rewinding a blocked snake requires complex memory allocation for path history, which I scoped out to maintain zero-GC during gameplay.
* **Addressables/Build Optimization:** For this time-frame, I chose to have something solid and playable in the Editor instead of worrying about build size optimization, which would be a crucial step for a full project.

### What I Would Improve Next With More Time

* **Audio & VFX:** Add satisfying pop/slide sound effects, haptic feedback, and a particle burst when an arrow successfully escapes the board.
* **Game Feel (Juice):** Add more color and visual feedback to arrows moving, hitting other arrows, and backtracking.
* **Lives System:** Like the reference game, a lives system where the player can lose after X wrong attempts.
* **Hints/Tutorial:** In the reference game, there's a hint button to show which arrows can be moved. That would be easily done here as well, but I'd do it in the first level as a tutorial to tell the player which arrows could be moved and why.
* **User Interface:** More panel specific behaviours, controlled by their specific scripts.

### AI Usage & Validation

Development began with an architectural brainstorm with Gemini, who presented an initial architectural plan and roadmap. Before writing any code, I challenged this roadmap with technical questions to ensure it fully understood the game's mechanics and scope. This revealed some architectural blind spots in the AI's initial plan, leading to crucial early pivots and establishing a much stronger foundation before development started, saving us from issues later on.

Once the architecture was locked in, Gemini was used as a pair-programming partner to bounce ideas (validating the Event-Driven UI approach), optimize mathematical algorithms (LineRenderer corner smoothing limits), and speed up boilerplate script generation.

* **Validation:** All generated logic was validated by writing most of the code manually, instead of just copy-pasting it and testing edge cases in the Editor. This often let to me finding discrepancies in code consistency and architecture, which could then be discussed and fixed.

### Configuration & The Level Editor

To make evaluation as smooth and enjoyable as possible, the game is entirely data-driven via ScriptableObjects. I highly encourage you to tweak the settings and build your own level!

* **Game Settings:** Locate the `GameSettingsSO` asset to tweak movement speeds, bump distances, and the visual staggered spawn delays without touching a single line of code.
* **The Visual Level Builder:**
    1. Open the `ArrowEscape` scene.
    2. Duplicate one of the existing levels under `ScriptableObjects/Levels` and rename it to whatever you want.
    3. Enable the `[Editor Level Builder]` GameObject and in its `Level Builder` script, add your new Level object under `TargetLevelData`.
    4. Place an `Arrow Authoring` prefab in the center of the scene and then use the transform tool to move it around (it will snap to the grid). You can then duplicate its child GameObject to extend the arrow's body.
    5. Add more arrows until pleased. For best results, add all arrows around the center of the editor (0, 0, 0).
    6. Press the `[Editor Level Builder]` GameObject, followed by the 3 dots in its `Level Builder` script, and then hit **"Bake Level Data"**.
    7. This instantly populates your `LevelDataSO`. Add it to the sequence list in `GameSettingsSO` to play it!

---

## Appendix: Development Timeline

To make sure I respected the given time-frame, I mapped my development timeline alongside git commits:

* `16:30 - 17:15`  **Setup, Events, Data SO & Level Builder:** Base architecture. Decided to automate arrow direction using head minus neck, instead of a defined Vector2Int or Enum.
* `17:15 - 18:15`  **Break:** Leaving office and running an errand.
* `18:15 - 18:30`  **Phase 3:** Finished baked level logic.
* `18:30 - 19:30`  **Phase 4 (Core Loop):** Grid, ArrowController, and Level Loader. Optimized grid registration to only update head and tail ends. Added head visuals, adjusted LineRenderer visual quirks, and implemented basic object pooling to replace Instantiate.
* `19:45 - 20:00`  **Input:** Replaced basic raycast input (which only collided with the head) with grid-position association, allowing the entire arrow body to be clickable.
* `20:00 - 20:15`  **Dynamic Camera:** Camera automatically adjusts to the level size, and arrows move one block at a time.
* `20:15 - 20:45`  **Break:** Dinner.
* `20:45 - 21:00`  **Arrow Glide & Collisions:** Scoped out physical backtracking collisions. Arrows now use a "look-ahead" check and only move if the path is clear.
* `21:00 - 21:20`  **Game Manager Logic:** Implemented loading a sequence of levels instead of just one.
* `21:20 - 23:00`  **UI:** Built the Event-Driven UI canvas.
* `23:00 - 23:30`  **Polish:** Final optimizations and data configuration.

---

## Contact Info

If any questions or problems arise that hinder the evaluation process, please don't hesitate to reach out!

* **LinkedIn:** [André Santos](https://www.linkedin.com/in/andrepucas/)
* **Email:** [andre.pucas.santos@gmail.com](mailto:andre.pucas.santos@gmail.com)
* **Portfolio:** [https://linktr.ee/andre_pucas](https://linktr.ee/andre_pucas)
