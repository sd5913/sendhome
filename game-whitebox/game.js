(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const FLOOR_Y = 460;
  const LEVEL_WIDTH = 2860;
  const GRAVITY = 1550;
  const JUMP_SPEED = 600;
  const PLATE_THRESHOLD = 4;
  const BREAK_SPEED = 500;
  const colors = ["#f3c94e", "#e38c55", "#86ad66"];

  const fishSpecs = [
    { id: 0, name: "鱼 A", grid: "1×1", width: 34, height: 36, weight: 1, speed: 2, color: colors[0] },
    { id: 1, name: "鱼 B", grid: "2×1", width: 66, height: 38, weight: 2, speed: 1.5, color: colors[1] },
    { id: 2, name: "鱼 C", grid: "2×2", width: 68, height: 68, weight: 4, speed: 1, color: colors[2] }
  ];

  const basePlatforms = [
    { x: 0, y: FLOOR_Y, width: LEVEL_WIDTH, height: HEIGHT - FLOOR_Y, kind: "ground" },
    { x: 430, y: 355, width: 130, height: 18, kind: "platform" },
    { x: 965, y: 370, width: 130, height: 18, kind: "platform" },
    { x: 1450, y: 355, width: 150, height: 18, kind: "platform" },
    { x: 2055, y: 370, width: 150, height: 18, kind: "platform" }
  ];

  const plateSpec = { x: 690, y: FLOOR_Y - 15, width: 112, height: 15 };
  const goalSpec = { x: 2600, y: 340, width: 160, height: FLOOR_Y - 340 };
  const keySpec = { x: 1130, y: FLOOR_Y - 54, width: 24, height: 34 };

  let state = createState();
  let cameraX = 0;
  let lastTime = 0;
  let statusTimer = 0;
  let resetHoldStart = 0;
  const keys = new Set();
  const touch = { left: false, right: false, dash: false };
  let jumpQueued = false;

  function createState() {
    return {
      fish: fishSpecs.map((spec, index) => ({
        ...spec,
        x: 82 + index * 64,
        y: FLOOR_Y - spec.height,
        vx: 0,
        vy: 0,
        grounded: true,
        arrived: false,
        dashing: false,
        support: "地面"
      })),
      boxes: [
        { x: 335, initialX: 335, y: FLOOR_Y - 58, width: 58, height: 58, weight: 2, force: 1.5 }
      ],
      doors: [
        { id: "plate", type: "plate", x: 860, y: FLOOR_Y - 132, width: 34, height: 132, heldOpen: false },
        { id: "key", type: "key", x: 1330, y: FLOOR_Y - 132, width: 34, height: 132, open: false },
        { id: "break", type: "break", x: 1905, y: FLOOR_Y - 132, width: 34, height: 132, broken: false }
      ],
      selected: 0,
      keyCollected: false,
      plateWeight: 0,
      plateOn: false,
      paused: false,
      completed: false,
      message: "先用方向键移动；按 1、2、3 查看三条鱼的速度和体型差异。",
      checkpointReached: false
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
      a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function horizontalOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x;
  }

  function doorOpen(door) {
    if (door.type === "plate") return state.plateOn || door.heldOpen;
    if (door.type === "key") return state.keyCollected;
    return door.broken;
  }

  function supportSurfaces(body) {
    return [
      ...basePlatforms,
      ...state.boxes.map(box => ({ ...box, kind: "box" })),
      ...state.fish
        .filter(fish => fish !== body)
        .map(fish => ({ ...fish, kind: "fish", label: fish.name }))
    ];
  }

  function canShiftBox(box, dx) {
    const candidate = { ...box, x: box.x + dx };
    if (candidate.x < 0 || candidate.x + candidate.width > LEVEL_WIDTH) return false;
    for (const other of state.boxes) {
      if (other !== box && overlaps(candidate, other)) return false;
    }
    for (const door of state.doors) {
      if (!doorOpen(door) && overlaps(candidate, door)) return false;
    }
    return true;
  }

  function boxBlockMessage(box, dx) {
    const candidate = { ...box, x: box.x + dx };
    const door = state.doors.find(item => !doorOpen(item) && overlaps(candidate, item));
    if (door) {
      const name = door.type === "plate" ? "压板门" : door.type === "key" ? "钥匙门" : "撞击门";
      return `箱子被关闭的${name}挡住了。`;
    }
    if (candidate.x < 0 || candidate.x + candidate.width > LEVEL_WIDTH) return "箱子到达关卡边界。";
    return "箱子前方有障碍。";
  }

  function moveHorizontally(body, dx, isFish) {
    const oldX = body.x;
    body.x += dx;
    body.x = Math.max(0, Math.min(LEVEL_WIDTH - body.width, body.x));

    for (const door of state.doors) {
      if (doorOpen(door) || !overlaps(body, door)) continue;
      const startedInside = oldX < door.x + door.width && oldX + body.width > door.x;
      const wasOnLeft = oldX + body.width / 2 < door.x + door.width / 2;
      if (startedInside && ((wasOnLeft && dx < 0) || (!wasOnLeft && dx > 0))) continue;
      if (door.type === "break" && isFish && body.dashing && Math.abs(body.vx) >= BREAK_SPEED) {
        door.broken = true;
        state.message = `${body.name} 冲破了门！`;
        continue;
      }
      body.x = startedInside
        ? (wasOnLeft ? door.x - body.width : door.x + door.width)
        : (dx > 0 ? door.x - body.width : door.x + door.width);
      body.vx = 0;
    }

    for (const box of state.boxes) {
      if (!overlaps(body, box)) continue;
      const direction = Math.sign(dx);
      const overlap = dx > 0
        ? body.x + body.width - box.x
        : box.x + box.width - body.x;
      const canPush = isFish && direction !== 0 && body.weight > box.force;
      const pushDistance = Math.max(0, overlap);
      if (canPush && canShiftBox(box, direction * pushDistance)) {
        box.x += direction * pushDistance;
      } else {
        state.message = canPush
          ? boxBlockMessage(box, direction * pushDistance)
          : `${body.name}力量不足，无法推动箱子。`;
        body.x = dx > 0 ? box.x - body.width : box.x + box.width;
        body.vx = 0;
      }
    }
  }

  function moveVertically(body, dy) {
    const oldBottom = body.y + body.height;
    body.y += dy;
    body.grounded = false;
    body.support = "空中";
    if (body.y < 0) {
      body.y = 0;
      body.vy = 0;
    }

    if (dy >= 0) {
      let landing = null;
      for (const surface of supportSurfaces(body)) {
        const newBottom = body.y + body.height;
        if (horizontalOverlap(body, surface) && oldBottom <= surface.y + 1 && newBottom >= surface.y) {
          if (!landing || surface.y < landing.y) landing = surface;
        }
      }
      if (landing) {
        body.y = landing.y - body.height;
        body.vy = 0;
        body.grounded = true;
        body.support = landing.label || (landing.kind === "ground" ? "地面" :
          landing.kind === "box" ? "箱子" : "平台");
      }
    }
  }

  function updateFish(fish, dt, isActive) {
    const axis = isActive ? (Number(keys.has("ArrowRight") || keys.has("KeyD") || touch.right) -
      Number(keys.has("ArrowLeft") || keys.has("KeyA") || touch.left)) : 0;
    const dashing = isActive && axis !== 0 && (keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.dash);
    const speed = fish.speed * 180 * (dashing ? 2 : 1);
    fish.vx = axis * speed;
    fish.dashing = dashing;

    if (isActive && jumpQueued && fish.grounded) {
      fish.vy = -JUMP_SPEED;
      fish.grounded = false;
    }

    moveHorizontally(fish, fish.vx * dt, true);
    fish.vy = Math.min(fish.vy + GRAVITY * dt, 950);
    moveVertically(fish, fish.vy * dt);

    if (fish.arrived) {
      fish.vx = 0;
      fish.vy = 0;
    }
  }

  function updatePlate() {
    const wasOn = state.plateOn;
    let total = 0;
    for (const fish of state.fish) {
      const onPlate = Math.abs(fish.y + fish.height - FLOOR_Y) < 2 &&
        horizontalOverlap(fish, plateSpec);
      if (onPlate) total += fish.weight;
    }
    for (const box of state.boxes) {
      const onPlate = Math.abs(box.y + box.height - FLOOR_Y) < 2 &&
        horizontalOverlap(box, plateSpec);
      if (onPlate) total += box.weight;
    }
    state.plateWeight = total;
    state.plateOn = total >= PLATE_THRESHOLD;
    const plateDoor = state.doors[0];
    const fishInDoor = state.fish.some(fish => overlaps(fish, plateDoor));
    plateDoor.heldOpen = !state.plateOn && fishInDoor && (wasOn || plateDoor.heldOpen);
  }

  function collectKey() {
    if (state.keyCollected) return;
    const keyRect = { ...keySpec, y: keySpec.y + Math.sin(performance.now() / 210) * 4 };
    const collector = state.fish.find(fish => overlaps(fish, keyRect));
    if (collector) {
      state.keyCollected = true;
      state.message = `${collector.name} 拿到了钥匙，钥匙门已解锁。`;
    }
  }

  function updateGoal() {
    for (const fish of state.fish) {
      if (!fish.arrived && overlaps(fish, goalSpec)) {
        fish.arrived = true;
        state.message = `${fish.name} 到达检查点（${state.fish.filter(item => item.arrived).length}/3）。`;
      }
    }
    if (!state.checkpointReached && state.fish.every(fish => fish.arrived)) {
      state.checkpointReached = true;
      state.completed = true;
      state.message = "白模测试完成：三条鱼都到达了检查点！";
    }
  }

  function update(dt) {
    if (state.paused || state.completed) return;
    const active = state.fish[state.selected];
    for (const fish of state.fish) updateFish(fish, dt, fish === active && !fish.arrived);
    updatePlate();
    collectKey();
    updateGoal();
    cameraX = Math.max(0, Math.min(LEVEL_WIDTH - WIDTH, active.x + active.width / 2 - WIDTH * 0.42));
  }

  function drawBackground() {
    ctx.fillStyle = "#e8f2f1";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    ctx.translate(-cameraX, 0);
    ctx.strokeStyle = "#d5e4e1";
    ctx.lineWidth = 1;
    for (let x = 0; x <= LEVEL_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FLOOR_Y);
      ctx.stroke();
    }
    for (let y = 20; y < FLOOR_Y; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(LEVEL_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);
    ctx.fillStyle = "#26383a";
    ctx.fillRect(0, FLOOR_Y, LEVEL_WIDTH, HEIGHT - FLOOR_Y);
    ctx.fillStyle = "#8fa9a4";
    for (const platform of basePlatforms.slice(1)) {
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    }
    ctx.fillStyle = "#f4d36a";
    ctx.fillRect(plateSpec.x, plateSpec.y, plateSpec.width, plateSpec.height);
    ctx.fillStyle = state.plateOn ? "#267a5b" : "#805f19";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(`压板 ${state.plateWeight}/${PLATE_THRESHOLD}`, plateSpec.x, plateSpec.y - 9);

    for (const box of state.boxes) {
      ctx.fillStyle = "#b5a58d";
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeStyle = "#655a4d";
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x + 2, box.y + 2, box.width - 4, box.height - 4);
      ctx.beginPath();
      ctx.moveTo(box.x + 8, box.y + 8);
      ctx.lineTo(box.x + box.width - 8, box.y + box.height - 8);
      ctx.moveTo(box.x + box.width - 8, box.y + 8);
      ctx.lineTo(box.x + 8, box.y + box.height - 8);
      ctx.stroke();
      ctx.fillStyle = "#26383a";
      ctx.font = "12px system-ui";
      ctx.fillText(`箱子 力>${box.force}`, box.x - 7, box.y - 8);
    }

    for (const door of state.doors) {
      if (doorOpen(door)) continue;
      ctx.fillStyle = door.type === "break" ? "#b96858" : "#788a91";
      ctx.fillRect(door.x, door.y, door.width, door.height);
      ctx.strokeStyle = "#26383a";
      ctx.lineWidth = 2;
      ctx.strokeRect(door.x, door.y, door.width, door.height);
      ctx.save();
      ctx.translate(door.x + door.width / 2, door.y + door.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 12px system-ui";
      ctx.fillText(door.type === "plate" ? "压板门" : door.type === "key" ? "钥匙门" : "冲刺撞门", 0, 4);
      ctx.restore();
    }

    if (!state.keyCollected) {
      const bob = Math.sin(performance.now() / 210) * 4;
      ctx.fillStyle = "#f6c949";
      ctx.beginPath();
      ctx.arc(keySpec.x + 12, keySpec.y + 12 + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#765b13";
      ctx.font = "bold 13px system-ui";
      ctx.fillText("钥匙", keySpec.x - 5, keySpec.y - 3 + bob);
    }

    ctx.fillStyle = "#9bd4c4";
    ctx.fillRect(goalSpec.x, goalSpec.y, goalSpec.width, goalSpec.height);
    ctx.strokeStyle = "#267a5b";
    ctx.lineWidth = 4;
    ctx.strokeRect(goalSpec.x, goalSpec.y, goalSpec.width, goalSpec.height);
    ctx.fillStyle = "#17483d";
    ctx.textAlign = "center";
    ctx.font = "bold 16px system-ui";
    ctx.fillText(`检查点 ${state.fish.filter(fish => fish.arrived).length}/3`, goalSpec.x + goalSpec.width / 2, goalSpec.y - 12);

    for (const fish of state.fish) drawFish(fish);
    drawZoneLabels();
    ctx.restore();
  }

  function drawFish(fish) {
    ctx.fillStyle = fish.color;
    ctx.fillRect(fish.x, fish.y, fish.width, fish.height);
    ctx.strokeStyle = fish === state.fish[state.selected] ? "#162b2d" : "#667579";
    ctx.lineWidth = fish === state.fish[state.selected] ? 4 : 2;
    ctx.strokeRect(fish.x, fish.y, fish.width, fish.height);
    ctx.fillStyle = "#fff";
    const eyeY = fish.y + Math.min(10, fish.height * 0.24);
    ctx.fillRect(fish.x + fish.width * 0.55, eyeY, 6, 8);
    ctx.fillRect(fish.x + fish.width * 0.73, eyeY, 6, 8);
    ctx.fillStyle = "#203437";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(fish.name, fish.x + fish.width / 2, fish.y - 8);
    if (fish === state.fish[state.selected]) {
      ctx.fillStyle = "#26383a";
      ctx.font = "11px system-ui";
      ctx.fillText(fish.arrived ? "已到达" : fish.dashing ? "冲刺" : "当前控制", fish.x + fish.width / 2, fish.y + fish.height + 15);
    }
    if (fish.arrived) {
      ctx.fillStyle = "#267a5b";
      ctx.fillRect(fish.x, fish.y - 5, fish.width, 4);
    }
  }

  function drawZoneLabels() {
    const labels = [
      { x: 70, text: "起点 / 角色差异" },
      { x: 300, text: "推箱测试" },
      { x: 650, text: "压力板测试" },
      { x: 1080, text: "钥匙测试" },
      { x: 1780, text: "冲刺撞门测试" },
      { x: 2620, text: "全员检查点" }
    ];
    ctx.fillStyle = "#40565a";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "left";
    for (const label of labels) ctx.fillText(label.text, label.x, 34);
  }

  function drawOverlay(title, detail) {
    ctx.fillStyle = "#122126b8";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px system-ui";
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 12);
    ctx.font = "18px system-ui";
    ctx.fillText(detail, WIDTH / 2, HEIGHT / 2 + 25);
  }

  function render() {
    drawBackground();
    drawWorld();
    if (state.paused) drawOverlay("已暂停", "按 Esc 或点击继续");
    if (state.completed) drawOverlay("白模测试完成", "点击“重置本关”继续测试");
  }

  function updatePanel() {
    const active = state.fish[state.selected];
    document.getElementById("position-status").textContent =
      `${Math.round(active.x)}, ${Math.round(active.y)}`;
    document.getElementById("support-status").textContent =
      active.support === "空中" || active.support === "地面" || active.support === "箱子" || active.support === "平台"
        ? active.support
        : `站在${active.support} 上`;
    const boxMoved = state.boxes.some(box => Math.abs(box.x - box.initialX) > 2);
    setStatus("box-status", boxMoved ? "已推动" : "未推动", boxMoved);
    document.getElementById("plate-status").textContent = `${state.plateWeight} / ${PLATE_THRESHOLD}`;
    setStatus("plate-door-status", doorOpen(state.doors[0]) ? "开启" : "关闭", doorOpen(state.doors[0]));
    setStatus("key-status", state.keyCollected ? "已取得" : "未取得", state.keyCollected);
    setStatus("break-door-status", state.doors[2].broken ? "已破坏" : "完好", state.doors[2].broken);
    document.getElementById("goal-status").textContent = `${state.fish.filter(fish => fish.arrived).length} / 3`;
    document.getElementById("message").textContent = state.message;
    document.getElementById("pause").textContent = state.paused ? "继续" : "暂停";
    document.querySelectorAll(".fish-button").forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === state.selected));
      button.disabled = state.fish[index].arrived;
    });
  }

  function setStatus(id, text, good) {
    const element = document.getElementById(id);
    element.textContent = text;
    element.className = `status-value ${good ? "good" : "warn"}`;
  }

  function selectFish(index) {
    const fish = state.fish[index];
    if (!fish || fish.arrived) return;
    state.selected = index;
    state.message = `${fish.name}：重量 ${fish.weight}，速度 ${fish.speed}。`;
    updatePanel();
  }

  function reset() {
    state = createState();
    cameraX = 0;
    keys.clear();
    jumpQueued = false;
    updatePanel();
  }

  document.getElementById("fish-list").innerHTML = fishSpecs.map(fish =>
    `<button type="button" class="fish-button" data-fish="${fish.id}" aria-pressed="false">` +
    `<span class="swatch" style="background:${fish.color}"></span>` +
    `<span>${fish.name}<br><span class="fish-meta">${fish.grid} 格 · 重 ${fish.weight} · 速 ${fish.speed}</span></span>` +
    `<span>${fish.id + 1}</span></button>`
  ).join("");

  document.querySelectorAll(".fish-button").forEach(button => {
    button.addEventListener("click", () => selectFish(Number(button.dataset.fish)));
  });
  document.getElementById("pause").addEventListener("click", () => {
    state.paused = !state.paused;
    updatePanel();
  });
  document.getElementById("reset").addEventListener("click", reset);

  window.addEventListener("keydown", event => {
    const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "Tab", "Escape", "KeyA", "KeyD", "KeyW", "KeyR", "Digit1", "Digit2", "Digit3", "ShiftLeft", "ShiftRight"];
    if (handled.includes(event.code)) event.preventDefault();
    if (!keys.has(event.code) && ["ArrowUp", "Space", "KeyW"].includes(event.code)) jumpQueued = true;
    keys.add(event.code);
    if (event.code === "Digit1") selectFish(0);
    if (event.code === "Digit2") selectFish(1);
    if (event.code === "Digit3") selectFish(2);
    if (event.code === "Tab" && !event.repeat) selectFish((state.selected + 1) % state.fish.length);
    if (event.code === "Escape" && !event.repeat) state.paused = !state.paused;
    if (event.code === "KeyR" && !event.repeat) resetHoldStart = performance.now();
    updatePanel();
  });

  window.addEventListener("keyup", event => {
    keys.delete(event.code);
    if (event.code === "KeyR") {
      if (resetHoldStart && performance.now() - resetHoldStart >= 700) reset();
      else if (resetHoldStart) state.message = "长按 R 至少 0.7 秒重置。";
      resetHoldStart = 0;
      updatePanel();
    }
  });
  window.addEventListener("blur", () => {
    keys.clear();
    touch.left = touch.right = touch.dash = false;
  });

  document.querySelectorAll("[data-hold]").forEach(button => {
    const key = button.dataset.hold;
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      touch[key] = true;
      button.setPointerCapture(event.pointerId);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(name, () => { touch[key] = false; });
    }
  });
  document.querySelector('[data-press="jump"]').addEventListener("pointerdown", event => {
    event.preventDefault();
    jumpQueued = true;
  });

  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.033) : 0;
    lastTime = time;
    update(dt);
    render();
    statusTimer += dt;
    if (statusTimer > 0.12) {
      updatePanel();
      statusTimer = 0;
    }
    jumpQueued = false;
    requestAnimationFrame(frame);
  }

  updatePanel();
  requestAnimationFrame(frame);
})();
