class StoryEngine {
  constructor() {
    this.story = loadStoryData();
    this.resetState();
  }

  resetState() {
    this.player = {
      stats: clone(this.story.stats),
      inventory: [...this.story.inventory],
      flags: {},
    };
    this.currentNode = this.story.start;
    this.history = [];
  }

  setStory(story) {
    this.story = story;
    saveStoryData(story);
    this.resetState();
  }

  getNode(nodeId) {
    return this.story.nodes[nodeId];
  }

  applyOption(option) {
    if (!option) return;
    const effects = option.effects || {};
    for (const [key, value] of Object.entries(effects)) {
      if (typeof value === "number") {
        this.player.stats[key] = (this.player.stats[key] || 0) + value;
      } else if (typeof value === "boolean") {
        this.player.flags[key] = value;
      }
    }

    if (option.flags) {
      for (const [flag, value] of Object.entries(option.flags)) {
        this.player.flags[flag] = value;
      }
    }

    if (option.inventory) {
      option.inventory.forEach((item) => {
        const action = item[0];
        const itemName = item.slice(1);
        if (action === "+") {
          if (!this.player.inventory.includes(itemName)) {
            this.player.inventory.push(itemName);
          }
        } else if (action === "-") {
          this.player.inventory = this.player.inventory.filter((i) => i !== itemName);
        }
      });
    }

    if (option.flags || option.effects?.phrase) {
      this.player.flags.phrase = option.flags?.phrase ?? option.effects?.phrase;
    }

    if (option.next) {
      this.history.push(this.currentNode);
      this.currentNode = option.next;
    }
  }

  canUseOption(option) {
    const requires = option.requires;
    if (!requires) return true;

    if (requires.inventory) {
      const items = Array.isArray(requires.inventory)
        ? requires.inventory
        : [requires.inventory];
      const missing = items.some((item) => !this.player.inventory.includes(item));
      if (missing) return false;
    }

    if (requires.stats) {
      return Object.entries(requires.stats).every(([stat, value]) => {
        return (this.player.stats[stat] || 0) >= value;
      });
    }

    if (requires.flags) {
      return Object.entries(requires.flags).every(([flag, value]) => {
        return Boolean(this.player.flags[flag]) === value;
      });
    }

    if (typeof requires.phrase !== "undefined") {
      return Boolean(this.player.flags.phrase) === Boolean(requires.phrase);
    }

    return true;
  }

  isEnding(node) {
    return Boolean(node.ending);
  }
}

class UIRenderer {
  constructor(engine) {
    this.engine = engine;
    this.storyTextEl = document.getElementById("story-text");
    this.storyTitleEl = document.getElementById("story-title");
    this.optionListEl = document.getElementById("option-list");
    this.statListEl = document.getElementById("stat-list");
    this.inventoryListEl = document.getElementById("inventory-list");
    this.historyListEl = document.getElementById("history-list");
    this.skillsListEl = document.getElementById("skills-list");
    this.storyDescriptionEl = document.getElementById("story-description");
    this.storyAuthorEl = document.getElementById("story-author");
    this.storyVersionEl = document.getElementById("story-version");
    this.storyStartEl = document.getElementById("story-start");
    this.profileNameEl = document.getElementById("profile-name");
    this.profileRoleEl = document.getElementById("profile-role");
    this.optionTemplate = document.getElementById("option-template");
    this.tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
    this.tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
    this.toast = ToastManager.global();
    this.bindTabs();
  }

  render() {
    const node = this.engine.getNode(this.engine.currentNode);
    if (!node) return;

    this.storyTitleEl.textContent = node.title || "Сцена";
    this.storyTextEl.textContent = node.text || "";

    this.renderOptions(node);
    this.renderStats();
    this.renderInventory();
    this.renderProfile();
    this.renderHistory();
    this.renderSkills();
  }

  bindTabs() {
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.switchTab(button.dataset.tabTarget);
      });
    });
  }

  switchTab(targetId) {
    this.tabButtons.forEach((button) => {
      const isActive = button.dataset.tabTarget === targetId;
      button.classList.toggle("is-active", isActive);
    });
    this.tabPanels.forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle("is-active", isActive);
    });
  }

  renderOptions(node) {
    this.optionListEl.innerHTML = "";

    if (this.engine.isEnding(node)) {
      const ending = document.createElement("div");
      ending.className = "ending-card";
      ending.innerHTML = `<strong>Финал: ${node.ending.type}</strong><br />${node.ending.summary}`;
      this.optionListEl.appendChild(ending);

      const restart = this.optionTemplate.content.firstElementChild.cloneNode(true);
      restart.textContent = "Вернуться к началу";
      restart.addEventListener("click", () => {
        this.engine.resetState();
        this.toast.show("История начата заново");
        this.render();
      });
      this.optionListEl.appendChild(restart);
      return;
    }

    const options = node.options || [];
    if (!options.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Здесь нет доступных действий. Вернитесь назад или перезапустите историю.";
      this.optionListEl.appendChild(empty);
      return;
    }

    options.forEach((option) => {
      const button = this.optionTemplate.content.firstElementChild.cloneNode(true);
      button.textContent = option.text;
      const available = this.engine.canUseOption(option);
      button.disabled = !available;
      if (!available) {
        button.classList.add("ghost");
        button.title = "Требования не выполнены";
      }
      button.addEventListener("click", () => {
        this.engine.applyOption(option);
        this.render();
      });
      this.optionListEl.appendChild(button);
    });
  }

  renderStats() {
    this.statListEl.innerHTML = "";
    const stats = Object.entries(this.engine.player.stats);
    if (!stats.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Характеристики пока не заданы.";
      this.statListEl.appendChild(empty);
      return;
    }

    const maxValue = Math.max(
      ...stats.map(([, value]) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
      }),
      1
    );

    stats.forEach(([stat, value]) => {
      const container = document.createElement("div");
      container.className = "stat-bar";

      const header = document.createElement("div");
      header.className = "stat-bar__header";
      const label = document.createElement("span");
      label.className = "stat-bar__label";
      label.textContent = stat;
      const val = document.createElement("span");
      val.className = "stat-bar__value";
      val.textContent = value;
      header.append(label, val);

      const meter = document.createElement("div");
      meter.className = "stat-bar__meter";
      const fill = document.createElement("span");
      const numericValueRaw = Number(value);
      const numericValue =
        typeof value === "number" && Number.isFinite(value)
          ? value
          : Number.isFinite(numericValueRaw)
          ? numericValueRaw
          : 0;
      const percent = Math.max(0, Math.min(100, (numericValue / maxValue) * 100));
      fill.style.width = `${percent}%`;
      meter.appendChild(fill);

      container.append(header, meter);
      this.statListEl.appendChild(container);
    });
  }

  renderInventory() {
    this.inventoryListEl.innerHTML = "";
    const items = this.engine.player.inventory;
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "inventory-item inventory-item--empty";
      empty.textContent = "Инвентарь пуст.";
      this.inventoryListEl.appendChild(empty);
      return;
    }

    items.forEach((itemName) => {
      const li = document.createElement("li");
      li.className = "inventory-item";
      li.textContent = itemName;
      this.inventoryListEl.appendChild(li);
    });
  }

  renderProfile() {
    const metadata = this.engine.story.metadata || {};
    if (this.profileNameEl) {
      this.profileNameEl.textContent = metadata.title || "Неизвестная история";
    }
    if (this.profileRoleEl) {
      this.profileRoleEl.textContent = metadata.author
        ? `Автор: ${metadata.author}`
        : "Mystic storyteller";
    }
    if (this.storyDescriptionEl) {
      this.storyDescriptionEl.textContent = metadata.description || "Описание истории пока не задано.";
    }
    if (this.storyAuthorEl) {
      this.storyAuthorEl.textContent = metadata.author || "—";
    }
    if (this.storyVersionEl) {
      this.storyVersionEl.textContent = metadata.version || "—";
    }
    if (this.storyStartEl) {
      this.storyStartEl.textContent = this.engine.story.start || "—";
    }
  }

  renderHistory() {
    if (!this.historyListEl) return;
    this.historyListEl.innerHTML = "";
    const timeline = [...this.engine.history, this.engine.currentNode].filter(Boolean);
    const nodes = timeline
      .map((id) => this.engine.getNode(id))
      .filter((node) => Boolean(node));
    const recent = nodes.slice(-6).reverse();

    if (!recent.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Вы ещё не делали выборов в этой сессии.";
      this.historyListEl.appendChild(empty);
      return;
    }

    recent.forEach((node) => {
      const item = document.createElement("li");
      item.className = "history-item";
      const title = document.createElement("span");
      title.textContent = node.title || node.id;
      const id = document.createElement("span");
      id.textContent = node.id;
      item.append(title, id);
      this.historyListEl.appendChild(item);
    });
  }

  renderSkills() {
    if (!this.skillsListEl) return;
    this.skillsListEl.innerHTML = "";

    const stats = Object.entries(this.engine.player.stats);
    const flags = Object.entries(this.engine.player.flags || {});

    if (!stats.length && !flags.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Навыки появятся по мере прохождения истории.";
      this.skillsListEl.appendChild(empty);
      return;
    }

    stats.forEach(([stat, value]) => {
      const card = document.createElement("li");
      card.className = "skill-card";
      const header = document.createElement("header");
      const name = document.createElement("span");
      name.textContent = stat;
      const badge = document.createElement("span");
      badge.className = "skill-badge";
      badge.textContent = this.describeStatLevel(Number(value));
      header.append(name, badge);
      const description = document.createElement("p");
      description.textContent = `Текущее значение: ${value}`;
      card.append(header, description);
      this.skillsListEl.appendChild(card);
    });

    flags
      .filter(([, value]) => value)
      .forEach(([flag]) => {
        const card = document.createElement("li");
        card.className = "skill-card";
        const header = document.createElement("header");
        const name = document.createElement("span");
        name.textContent = flag;
        const badge = document.createElement("span");
        badge.className = "skill-badge";
        badge.textContent = "Активно";
        header.append(name, badge);
        const description = document.createElement("p");
        description.textContent = "Специальное условие истории активно.";
        card.append(header, description);
        this.skillsListEl.appendChild(card);
      });
  }

  describeStatLevel(value) {
    if (value >= 5) return "Легендарно";
    if (value >= 3) return "Опытно";
    if (value >= 1) return "Новичок";
    return "Слабый";
  }
}

class AdminPanel {
  constructor(engine, ui) {
    this.engine = engine;
    this.ui = ui;
    this.panel = document.getElementById("admin-panel");
    this.showAdminBtn = document.getElementById("show-admin");
    this.toggleBtn = document.getElementById("toggle-admin");

    this.nodeForm = document.getElementById("node-form");
    this.choiceForm = document.getElementById("choice-form");
    this.exportBtn = document.getElementById("export-story");
    this.importInput = document.getElementById("import-story");
    this.resetBtn = document.getElementById("reset-story");
    this.sceneList = document.getElementById("scene-list");
    this.sceneFilter = document.getElementById("scene-filter");
    this.sceneCount = document.getElementById("scene-count");
    this.activeNodeId = null;

    this.bindEvents();
    this.renderSceneList();
  }

  bindEvents() {
    this.showAdminBtn.addEventListener("click", () => {
      const shouldShow = this.panel.classList.contains("hidden");
      this.setAdminVisibility(shouldShow);
    });

    this.toggleBtn.addEventListener("click", () => {
      this.setAdminVisibility(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.setAdminVisibility(false);
      }
    });

    if (this.sceneFilter) {
      this.sceneFilter.addEventListener("input", () => this.renderSceneList());
    }

    if (this.sceneList) {
      this.sceneList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-node]");
        if (!button) return;
        this.loadNode(button.dataset.node);
      });
    }

    this.nodeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(this.nodeForm);
      const nodeId = formData.get("nodeId").trim();
      const title = formData.get("title").trim();
      const description = formData.get("description").trim();
      if (!nodeId || !title || !description) {
        ToastManager.global().show("Заполните все поля сцены", "warning");
        return;
      }

      const nodes = { ...this.engine.story.nodes };
      nodes[nodeId] = nodes[nodeId] || { id: nodeId, options: [] };
      nodes[nodeId].title = title;
      nodes[nodeId].text = description;
      nodes[nodeId].options = nodes[nodeId].options || [];

      const updatedStory = {
        ...this.engine.story,
        nodes,
      };

      this.engine.setStory(updatedStory);
      this.ui.render();
      this.nodeForm.reset();
      this.setActiveNode(nodeId);
      if (this.choiceForm?.elements?.fromNode) {
        this.choiceForm.elements.fromNode.value = nodeId;
      }
      this.renderSceneList();
      ToastManager.global().show(`Сцена «${title}» сохранена`);
    });

    this.choiceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(this.choiceForm);
      const fromNode = formData.get("fromNode").trim();
      const choiceText = formData.get("choiceText").trim();
      const toNode = formData.get("toNode").trim();
      const statChanges = formData.get("statChanges").trim();
      const inventory = formData.get("inventory").trim();

      if (!fromNode || !choiceText || !toNode) {
        ToastManager.global().show("Заполните обязательные поля выбора", "warning");
        return;
      }

      if (!this.engine.story.nodes[fromNode]) {
        ToastManager.global().show(`Сцена ${fromNode} не найдена`, "warning");
        return;
      }

      const option = {
        text: choiceText,
        next: toNode,
      };

      if (statChanges) {
        option.effects = this.parseStatChanges(statChanges);
      }

      if (inventory) {
        option.inventory = inventory
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      const nodes = { ...this.engine.story.nodes };
      nodes[fromNode] = {
        ...nodes[fromNode],
        options: [...(nodes[fromNode].options || []), option],
      };

      const updatedStory = {
        ...this.engine.story,
        nodes,
      };

      this.engine.setStory(updatedStory);
      this.ui.render();
      this.choiceForm.reset();
      this.setActiveNode(fromNode);
      this.renderSceneList();
      ToastManager.global().show("Выбор добавлен");
    });

    this.exportBtn.addEventListener("click", () => {
      const dataStr = JSON.stringify(this.engine.story, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mystic-stories-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      ToastManager.global().show("История экспортирована");
    });

    this.importInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      file
        .text()
        .then((content) => JSON.parse(content))
        .then((story) => {
          if (!story.nodes) {
            throw new Error("Некорректный формат истории");
          }
          this.engine.setStory(story);
          this.ui.render();
          this.renderSceneList();
          ToastManager.global().show("История импортирована");
        })
        .catch((error) => {
          console.error(error);
          ToastManager.global().show("Не удалось импортировать историю", "warning");
        })
        .finally(() => {
          this.importInput.value = "";
        });
    });

    this.resetBtn.addEventListener("click", () => {
      const story = resetStoryData();
      this.engine.setStory(story);
      this.ui.render();
      this.activeNodeId = null;
      this.renderSceneList();
      ToastManager.global().show("История сброшена к версии по умолчанию");
    });
  }

  setAdminVisibility(visible) {
    this.panel.classList.toggle("hidden", !visible);
    this.panel.setAttribute("aria-hidden", String(!visible));
    this.showAdminBtn.setAttribute("aria-expanded", String(visible));
    if (visible) {
      this.renderSceneList();
      if (this.sceneFilter && !this.sceneFilter.value) {
        try {
          this.sceneFilter.focus({ preventScroll: true });
        } catch (error) {
          this.sceneFilter.focus();
        }
      }
    }
  }

  parseStatChanges(input) {
    return input.split(",").reduce((acc, pair) => {
      const [key, value] = pair.split(":").map((item) => item.trim());
      if (!key || !value) return acc;
      const number = Number(value);
      if (!Number.isNaN(number)) {
        acc[key] = number;
      } else if (value === "true" || value === "false") {
        acc[key] = value === "true";
      }
      return acc;
    }, {});
  }

  renderSceneList() {
    if (!this.sceneList) return;
    const filter = (this.sceneFilter?.value || "").trim().toLowerCase();
    const nodes = Object.values(this.engine.story.nodes || {});
    nodes.sort((a, b) => {
      const aTitle = (a.title || a.id || "").toLowerCase();
      const bTitle = (b.title || b.id || "").toLowerCase();
      return aTitle.localeCompare(bTitle, "ru");
    });

    const fragment = document.createDocumentFragment();
    let count = 0;

    nodes.forEach((node) => {
      const searchable = `${node.title || ""} ${node.id}`.toLowerCase();
      if (filter && !searchable.includes(filter)) {
        return;
      }
      count += 1;

      const item = document.createElement("li");
      item.className = "scene-list-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-list-button";
      button.dataset.node = node.id;
      if (node.id === this.activeNodeId) {
        button.classList.add("is-active");
      }

      const title = document.createElement("span");
      title.className = "scene-list-title";
      title.textContent = node.title || "Без названия";

      const meta = document.createElement("div");
      meta.className = "scene-list-meta";
      const idTag = document.createElement("span");
      idTag.textContent = `ID: ${node.id}`;
      const optionsTag = document.createElement("span");
      const optionTotal = node.options?.length ?? 0;
      optionsTag.textContent = this.formatChoiceCount(optionTotal);
      meta.append(idTag, optionsTag);
      if (this.engine.isEnding(node)) {
        const badge = document.createElement("span");
        badge.className = "scene-badge";
        badge.textContent = "Финал";
        meta.appendChild(badge);
      }

      if (node.text) {
        const summary = document.createElement("span");
        summary.className = "scene-list-summary";
        const trimmed = node.text.length > 96 ? `${node.text.slice(0, 93)}…` : node.text;
        summary.textContent = trimmed;
        meta.appendChild(summary);
      }

      button.append(title, meta);
      item.appendChild(button);
      fragment.appendChild(item);
    });

    this.sceneList.innerHTML = "";
    if (!count) {
      const empty = document.createElement("li");
      empty.className = "scene-empty";
      empty.textContent = filter
        ? "Сцены по запросу не найдены."
        : "Добавьте первую сцену, чтобы начать историю.";
      this.sceneList.appendChild(empty);
    } else {
      this.sceneList.appendChild(fragment);
      this.setActiveNode(this.activeNodeId);
    }

    if (this.sceneCount) {
      this.sceneCount.textContent = String(count);
    }
  }

  loadNode(nodeId) {
    const node = this.engine.getNode(nodeId);
    if (!node) {
      ToastManager.global().show(`Сцена ${nodeId} не найдена`, "warning");
      return;
    }

    this.activeNodeId = nodeId;
    if (this.nodeForm) {
      this.nodeForm.elements.nodeId.value = node.id;
      this.nodeForm.elements.title.value = node.title || "";
      this.nodeForm.elements.description.value = node.text || "";
    }
    if (this.choiceForm?.elements?.fromNode) {
      this.choiceForm.elements.fromNode.value = node.id;
    }
    this.setActiveNode(nodeId);
  }

  setActiveNode(nodeId) {
    this.activeNodeId = nodeId;
    if (!this.sceneList) return;
    this.sceneList
      .querySelectorAll(".scene-list-button")
      .forEach((button) => {
        button.classList.toggle("is-active", button.dataset.node === nodeId);
      });
  }

  formatChoiceCount(count) {
    if (count === 1) return "1 выбор";
    if (count > 1 && count < 5) return `${count} выбора`;
    return `${count} выборов`;
  }
}

class ToastManager {
  constructor() {
    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  }

  static global() {
    if (!window.__toastManager) {
      window.__toastManager = new ToastManager();
    }
    return window.__toastManager;
  }

  show(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 400);
    }, 2400);
  }
}

function setupControls(engine, ui) {
  const restartBtn = document.getElementById("restart-game");
  restartBtn.addEventListener("click", () => {
    engine.resetState();
    ui.render();
    ToastManager.global().show("Игра начата заново");
  });
}

function bootstrap() {
  const engine = new StoryEngine();
  const ui = new UIRenderer(engine);
  const admin = new AdminPanel(engine, ui);
  setupControls(engine, ui);
  ui.render();
  return { engine, ui, admin };
}

document.addEventListener("DOMContentLoaded", bootstrap);
