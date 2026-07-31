AINEX FALL RECOVERY LAB V10 - CTAT PACKAGE

Package structure
-----------------
HTML/recovery-from-fall-v10.html
HTML/Assets/recovery-from-fall-styles-v10.css
HTML/Assets/robot-digital-twin-v10.js
HTML/Assets/ainex-robot.png
FinalBRDs/recovery-from-fall-v10.brd

Typography
----------
The CSS uses an Anthropic-style stack: Styrene B / Styrene A for interface
text and Copernicus / Tiempos Text for display headings, with DM Sans and
Source Serif 4 as web-safe fallbacks. Proprietary font binaries are not
redistributed in this package.

Behavior Graph
--------------
The graph is a state-dependent evidence and control challenge:

1. Q1 creates one of five explicit visual-observation lanes.
2. Q2-Q5X preserve that hypothesis rather than merging it immediately.
3. Q5Y crosses five observation lanes with five IMU classifications. The 25
   crossings provide state-specific agreement or conflict feedback.
4. Q6-Q9 preserve the IMU-derived state through condition, adapter key,
   blackboard value, and recovery action.
5. Q10 crosses all five initial action routes with all five possible fresh
   post-recovery states.
6. Q10 feedback distinguishes verified standing, a confirmed front/back fall
   that needs a direction-specific retry, and a leaning/drift case that needs
   re-zeroing and reclassification.

The graph contains 75 nodes, 150 edges, and 125 complete correct paths.
Progressive hints move from conceptual cues to the exact next step. Explicit
buggy branches cover the concept, condition, blackboard, action, and recovery
verification decisions.

State policy
------------
  Y <= -90 degrees       -> fall_front       -> recline_to_stand.d6a
  -90 < Y < -20 degrees  -> leaning_forward  -> No action
  -20 <= Y <= 20 degrees -> stand            -> No action
  20 < Y < 90 degrees    -> leaning_backward -> No action
  Y >= 90 degrees        -> fall_back        -> lie_to_stand.d6a

Important sensor limitation
---------------------------
An HTML/BRD-only tutor cannot read the frozen snapshot in a separate Robot
Sensor Viewer. It therefore cannot verify that X and Z were copied exactly
within +/-2 degrees. The Y value entered by the student selects the graph
branch. Enforcing equality with the external viewer requires an adapter that
sends the frozen values into CTAT.

Robot Digital Twin tutor
------------------------
The optional right sidebar is not part of the required behavior-graph path.
It uses the OpenAI Responses API and the editable model name shown in the
sidebar. V10 defaults to gpt-4o-mini for broad project compatibility and low
cost; the model field remains editable.

1. Open the tutor page.
2. Paste an OpenAI API key into the password field.
3. Edit the model name if necessary.
4. Select Connect, then ask a question.

No API key is included in this package. The page keeps the entered key only in
JavaScript memory for the current page session and clears the visible field
after connection. It does not use localStorage or write the key to a file.

V10 CTAT compatibility fix
-------------------------
V10 explicitly defines ctatOnload and initializes CTAT with:

  ../FinalBRDs/recovery-from-fall-v10.brd

This fixed binding prevents an older question_file URL parameter or an older
open graph tab from silently selecting V4, V7, V8, or V9.

Q1 is a five-option CTATRadioButton group rebuilt from the official CTAT radio
button pattern. Every option uses the shared component group "observedPose" and
sends one standard SAI. For Stand, that SAI is:

  observedPose / UpdateRadioButton / poseStand: Stand

The option text is inline so the generated radio input is exactly the same as
the BRD input. The BRD has exactly five first-step edges and uses CTAT's
standard concatenated Selection, Action, and Input exact matchers. It contains
no Q1 button aliases, default-group aliases, wildcard Q1 matchers, or legacy
Q1 edges. Q2-Q10 and all 145 downstream edges are unchanged.

All radio-button groups use the same official CTAT contract:

  observedPose     / UpdateRadioButton / pose component ID: visible label
  axisChoice       / UpdateRadioButton / axis component ID: visible label
  recoveryDecision / UpdateRadioButton / decision component ID: visible label

All ten radio components have one-line inline labels, an explicit shared name
per group, and data-ctat-tutor="true". Every correct radio edge uses CTAT's
concatenated Selection, Action, and Input exact matchers. Buggy radio edges
retain their standard wildcard input matcher so incorrect choices receive
feedback without advancing the correct path.

V10 also retains the LLM fixes: it restores robotTutorStatus, creates that
element automatically if CTAT removes it, waits for CTAT DOM insertion,
rebinds after interface replacement, and reports invalid keys, unavailable
models, billing limits, and blocked network connections.

This is a browser-side private-testing prototype. For a shared, public, or
production deployment, route requests through a server-side proxy so students
never handle or expose a reusable API key. The CTAT host must permit HTTPS
connections to https://api.openai.com through its Content Security Policy and
network allowlist.

Import
------
Keep the HTML and FinalBRDs directories as siblings at the project root. Open
HTML/recovery-from-fall-v10.html in CTAT Authoring Tools. The HTML now binds
itself to FinalBRDs/recovery-from-fall-v10.brd, so no older BRD should be
selected. For the cleanest test, import this V10-only package as a new project
instead of copying it into a folder that still contains V4, V7, V8, or V9
files.
