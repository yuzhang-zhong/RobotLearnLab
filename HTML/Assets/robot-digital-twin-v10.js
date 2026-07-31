(() => {
  "use strict";

  const VERSION = "v10";
  const API_URL = "https://api.openai.com/v1/responses";
  const DEFAULT_MODEL = "gpt-4o-mini";
  const state = {
    apiKey: "",
    conversation: [],
    requestInFlight: false,
  };
  const boundForms = new WeakSet();

  window.RobotTutorDiagnostics = {
    version: VERSION,
    initialized: false,
    apiUrl: API_URL,
    lastRequestId: "",
    lastError: "",
  };

  const tutorInstructions = [
    "You are the AINEX Robot Digital Twin, an optional tutor embedded in a CTAT fall-recovery lesson.",
    "Speak in first person as the robot, but never claim that you can currently see the camera, read the live IMU, or execute a physical motion.",
    "If the student asks about the current pose or reading, ask them to paste the frozen sensor values or describe what they observe.",
    "Teach through concise scaffolding: identify the student's current idea, ask for evidence, give one useful hint, and then explain directly if they still need help.",
    "Use the student's language. Keep most answers under 140 words unless the student explicitly asks for more detail.",
    "Course facts: the IMU is the primary fall sensor; Y is pitch for front/back rotation; the ROS command is rostopic echo /imu_gui.",
    "State policy: Y <= -90 is fall_front; -90 < Y < -20 is leaning_forward; -20 <= Y <= 20 is stand; 20 < Y < 90 is leaning_backward; Y >= 90 is fall_back.",
    "Behavior policy: write the interpreted value under robot_state. fall_front uses recline_to_stand.d6a; fall_back uses lie_to_stand.d6a; stand and leaning states use No action.",
    "Verification policy: stand means finish; fall_front means retry recline_to_stand.d6a; fall_back means retry lie_to_stand.d6a; either leaning state means hold still, re-zero, and classify again.",
    "Explain gyroscope drift as accumulated integration error. Judge recovery by the stand band rather than exact equality with the original baseline.",
    "Do not reveal an answer key merely because the student asks for every answer at once. Help with the current concept or step.",
    "When physical movement is involved, remind the student to keep the robot supported and the area clear.",
  ].join(" ");

  function createStatus(sidebar, modelInput) {
    let status = document.getElementById("robotTutorStatus");
    if (status) {
      return status;
    }

    status = document.createElement("p");
    status.id = "robotTutorStatus";
    status.className = "twinStatus";
    status.setAttribute("role", "status");
    status.textContent =
      "Ready. Enter a project API key, then select Connect.";

    const setup = modelInput.closest(".twinSetup") || sidebar;
    setup.appendChild(status);
    return status;
  }

  function addWelcomeMessage(messages) {
    if (messages.children.length > 0) {
      return;
    }

    const welcome = document.createElement("div");
    welcome.className = "twinMessage twinMessageRobot";
    welcome.textContent =
      "Ask me about the IMU, pitch thresholds, ROS commands, the blackboard, recovery actions, or sensor drift.";
    messages.appendChild(welcome);
  }

  function appendMessage(messages, text, role, pending = false) {
    const bubble = document.createElement("div");
    bubble.className =
      role === "user"
        ? "twinMessage twinMessageUser"
        : "twinMessage twinMessageRobot";
    if (pending) {
      bubble.classList.add("twinMessagePending");
    }
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function extractResponseText(data) {
    if (
      data &&
      typeof data.output_text === "string" &&
      data.output_text.trim()
    ) {
      return data.output_text.trim();
    }

    if (!data || !Array.isArray(data.output)) {
      return "";
    }

    const parts = [];
    data.output.forEach((item) => {
      if (!item || !Array.isArray(item.content)) {
        return;
      }
      item.content.forEach((content) => {
        if (
          content &&
          content.type === "output_text" &&
          typeof content.text === "string"
        ) {
          parts.push(content.text);
        }
      });
    });
    return parts.join("\n").trim();
  }

  function makeRequestError(response, data, requestId) {
    const apiMessage =
      data &&
      data.error &&
      typeof data.error.message === "string" &&
      data.error.message.trim()
        ? data.error.message.trim()
        : "";
    const apiCode =
      data && data.error && data.error.code ? String(data.error.code) : "";

    let guidance = "";
    if (response.status === 401) {
      guidance =
        "The API key was rejected. Create or copy a project API key again.";
    } else if (response.status === 403) {
      guidance =
        "The project or organization policy blocked this request. Check the key's model permissions or IP restrictions.";
    } else if (response.status === 404) {
      guidance =
        "This project cannot access the selected model. Try gpt-4o-mini or another model enabled for the project.";
    } else if (response.status === 429) {
      guidance =
        "The project has reached a rate limit or has no available API credit. Check API billing and usage limits.";
    } else if (response.status >= 500) {
      guidance =
        "The OpenAI service returned a temporary server error. Wait briefly and try again.";
    } else {
      guidance = `The OpenAI request failed with status ${response.status}.`;
    }

    const detail = apiMessage || apiCode;
    const suffix = requestId ? ` Request ID: ${requestId}.` : "";
    const error = new Error(
      `${guidance}${detail ? ` API detail: ${detail}` : ""}${suffix}`,
    );
    error.status = response.status;
    error.requestId = requestId;
    return error;
  }

  function userFacingNetworkError(error) {
    if (error && error.name === "AbortError") {
      return "The request timed out after 60 seconds. Try again.";
    }

    if (error instanceof TypeError) {
      return [
        "The browser could not reach api.openai.com.",
        "In CTAT this usually means the host's Content Security Policy or network allowlist blocks external API connections.",
        "Open the browser console and look for a connect-src or CORS message.",
      ].join(" ");
    }

    return error && error.message
      ? error.message
      : "The tutor request failed for an unknown reason.";
  }

  function initializeTutor() {
    const sidebar = document.getElementById("robotTutorSidebar");
    const keyInput = document.getElementById("robotTutorApiKey");
    const modelInput = document.getElementById("robotTutorModel");
    const connectButton = document.getElementById("connectRobotTutor");
    const messages = document.getElementById("robotTutorMessages");
    const form = document.getElementById("robotTutorForm");
    const questionInput = document.getElementById("robotTutorQuestion");
    const askButton = document.getElementById("askRobotTutor");

    if (
      !sidebar ||
      !keyInput ||
      !modelInput ||
      !connectButton ||
      !messages ||
      !form ||
      !questionInput ||
      !askButton
    ) {
      return false;
    }

    const status = createStatus(sidebar, modelInput);
    addWelcomeMessage(messages);

    if (boundForms.has(form)) {
      return true;
    }
    boundForms.add(form);
    form.dataset.robotTutorBound = VERSION;
    document.documentElement.dataset.robotTutorScript = VERSION;
    window.RobotTutorDiagnostics.initialized = true;

    function setStatus(text, tone = "") {
      status.textContent = text;
      status.dataset.tone = tone;
    }

    connectButton.addEventListener("click", () => {
      const candidate = keyInput.value.trim();
      if (candidate.length < 20) {
        setStatus(
          "Enter a complete OpenAI project API key before connecting.",
          "error",
        );
        keyInput.focus();
        return;
      }

      state.apiKey = candidate;
      keyInput.value = "";
      setStatus(
        "Key loaded for this page session. Ask a question to test the API connection.",
        "ready",
      );
      questionInput.focus();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const question = questionInput.value.trim();
      if (!state.apiKey) {
        setStatus("Load an OpenAI project API key first.", "error");
        keyInput.focus();
        return;
      }
      if (!question || state.requestInFlight) {
        questionInput.focus();
        return;
      }

      const model = modelInput.value.trim() || DEFAULT_MODEL;
      appendMessage(messages, question, "user");
      state.conversation.push({ role: "Student", text: question });
      questionInput.value = "";
      state.requestInFlight = true;
      askButton.disabled = true;
      connectButton.disabled = true;
      setStatus(`Contacting OpenAI with ${model}...`, "working");
      const pending = appendMessage(messages, "Thinking…", "robot", true);

      const transcript = state.conversation
        .slice(-10)
        .map((turn) => `${turn.role}: ${turn.text}`)
        .join("\n");

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          headers: {
            Authorization: `Bearer ${state.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            instructions: tutorInstructions,
            input: transcript,
            max_output_tokens: 500,
            store: false,
          }),
          signal: controller.signal,
        });

        const requestId = response.headers.get("x-request-id") || "";
        window.RobotTutorDiagnostics.lastRequestId = requestId;

        const raw = await response.text();
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (_parseError) {
            data = {};
          }
        }

        if (!response.ok) {
          throw makeRequestError(response, data, requestId);
        }

        const answer = extractResponseText(data);
        if (!answer) {
          throw new Error(
            `The API returned no readable text.${requestId ? ` Request ID: ${requestId}.` : ""}`,
          );
        }

        pending.textContent = answer;
        pending.classList.remove("twinMessagePending");
        state.conversation.push({ role: "Robot tutor", text: answer });
        setStatus(
          `Connected · ${model}${requestId ? ` · request ${requestId}` : ""}`,
          "ready",
        );
        window.RobotTutorDiagnostics.lastError = "";
      } catch (error) {
        const message = userFacingNetworkError(error);
        pending.textContent = `I could not answer: ${message}`;
        pending.classList.remove("twinMessagePending");
        pending.classList.add("twinMessageError");
        setStatus(message, "error");
        window.RobotTutorDiagnostics.lastError = message;
      } finally {
        window.clearTimeout(timeout);
        state.requestInFlight = false;
        askButton.disabled = false;
        connectButton.disabled = false;
        questionInput.focus();
      }
    });

    return true;
  }

  let retryCount = 0;
  let retryTimer = 0;

  function boot() {
    window.clearTimeout(retryTimer);
    if (initializeTutor()) {
      return;
    }

    retryCount += 1;
    if (retryCount <= 80) {
      retryTimer = window.setTimeout(boot, 250);
    } else {
      window.RobotTutorDiagnostics.lastError =
        "Tutor controls were not found after 20 seconds.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener("load", boot, { once: true });

  const observer = new MutationObserver(() => {
    const form = document.getElementById("robotTutorForm");
    const status = document.getElementById("robotTutorStatus");
    if (form && (!boundForms.has(form) || !status)) {
      boot();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
