# RobotLearnLab

RobotLearnLab is an intelligent tutoring system that teaches novice robot operators how to diagnose a humanoid robot fall, select an appropriate recovery action, and verify that the robot is standing safely.

The project was developed for the **Intelligent Tutoring System (ITS) track at the CMU 2026 LearnLab Summer School**. It combines a CMU CTAT example-tracing tutor with an optional generative-AI “robot digital twin” that explains the reasoning behind each step without controlling lesson progression or directly commanding the robot.

## What students learn

The tutor guides students through a ten-question evidence-to-action workflow:

1. Observe and classify the robot's pose.
2. Identify the IMU as the primary fall sensor.
3. Inspect the live IMU stream with `rostopic echo /imu_gui`.
4. Use the Y-axis pitch angle to detect front and back falls.
5. Record a frozen sensor snapshot.
6. Map the pitch interval to a robot state.
7. Select the `robot_state` blackboard key.
8. Write the interpreted state to the blackboard.
9. Select the matching recovery motion.
10. Re-read the robot state and verify recovery using the standing band rather than exact equality with the original sensor reading.

## Recovery policy

| Y-axis pitch | Interpreted state | Recovery action |
| --- | --- | --- |
| `Y <= -90°` | `fall_front` | `recline_to_stand.d6a` |
| `-90° < Y < -20°` | `leaning_forward` | No action |
| `-20° <= Y <= 20°` | `stand` | No action |
| `20° < Y < 90°` | `leaning_backward` | No action |
| `Y >= 90°` | `fall_back` | `lie_to_stand.d6a` |

The lesson emphasizes that IMU integration drift can shift the post-recovery reading. A safe recovery is therefore judged by the standing band, `-20° <= Y <= 20°`, instead of requiring the sensor to return to its original value.

## Key features

- **CTAT example tracing:** an adaptive behavior graph evaluates each response, updates progress, and provides targeted feedback or progressively more specific hints.
- **Multiple reasoning routes:** five visual-observation lanes are crossed with five IMU classifications, allowing state-specific agreement and conflict feedback.
- **Sensor-to-policy reasoning:** students connect visual evidence, IMU readings, fall classification, blackboard state, recovery motion, and verification.
- **Optional AI digital twin:** an embedded OpenAI-powered tutor explains IMU thresholds, ROS commands, recovery actions, and sensor drift in the student's language.
- **Safety-aware tutoring:** the digital twin does not claim live access to the robot and reminds students to support the robot and clear the area before physical movement.

The included behavior graph contains 75 nodes, 150 edges, and 125 complete correct paths.

## Repository structure

```text
RobotLearnLab/
├── FinalBRDs/
│   └── recovery-from-fall-v10.brd
├── HTML/
│   ├── recovery-from-fall-v10.html
│   └── Assets/
│       ├── ainex-robot.png
│       ├── recovery-from-fall-styles-v10.css
│       └── robot-digital-twin-v10.js
├── README.md
└── README.txt
```

## Run the tutor in CTAT

1. Clone or download this repository.
2. Keep `HTML` and `FinalBRDs` as sibling directories at the repository root.
3. Import the V10 package as a new project in [CTAT Authoring Tools](https://github.com/CMUCTAT/CTAT/wiki).
4. Open `HTML/recovery-from-fall-v10.html`.

The page explicitly binds to `../FinalBRDs/recovery-from-fall-v10.brd`, preventing an older graph or `question_file` parameter from silently loading a previous version.

Internet access is required for the CTAT CDN assets and Google Fonts referenced by the tutor page.

## Optional Robot Digital Twin

The right-hand sidebar can call the OpenAI Responses API as an optional source of explanations:

1. Open the tutor page.
2. Paste an OpenAI project API key into the password field.
3. Change the model name if needed; the prototype defaults to `gpt-4o-mini`.
4. Select **Connect**, then ask a question.

No API key is included in this repository. The browser keeps the entered key only in JavaScript memory for the current page session and does not write it to a file or `localStorage`.

> [!WARNING]
> The direct browser-to-API integration is intended only for private testing. For a shared or production deployment, send requests through a server-side proxy so students never handle or expose a reusable API key. The host must also allow HTTPS connections to `https://api.openai.com` through its Content Security Policy and network rules.

## Sensor integration limitation

The HTML/BRD tutor cannot independently read a frozen snapshot from a separate Robot Sensor Viewer. The Y value entered by the student selects the behavior-graph branch, but exact X/Z equality cannot be enforced without an adapter that sends the frozen sensor values into CTAT.

## Team

- Yuzhang Zhong
- Xingyu Zheng
- Yixin Zhang

Developed for the ITS track at the CMU 2026 LearnLab Summer School.

## Acknowledgments

- [CMU Cognitive Tutor Authoring Tools (CTAT)](https://github.com/CMUCTAT/CTAT)
- AINEX humanoid robot platform
- OpenAI Responses API for the optional digital-twin tutor
