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
    this.optionTemplate = document.getElementById("option-template");
    this.toast = ToastManager.global();
  }

  render() {
    const node = this.engine.getNode(this.engine.currentNode);
    if (!node) return;

    this.storyTitleEl.textContent = node.title || "Сцена";
    this.storyTextEl.textContent = node.text || "";

    this.renderOptions(node);
    this.renderStats();
  }

  renderOptions(node) {
    this.optionListEl.innerHTML = "";

    if (this.engine.isEnding(node)) {
      const ending = document.createElement("div");
      ending.className = "notice";
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
      const noOptions = document.createElement("div");
      noOptions.className = "notice";
      noOptions.textContent = "Здесь нет доступных действий. Вернитесь назад или перезапустите историю.";
      this.optionListEl.appendChild(noOptions);
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
    Object.entries(this.engine.player.stats).forEach(([stat, value]) => {
      const item = document.createElement("li");
      item.className = "stat-item";
      item.innerHTML = `<span>${stat}</span><span>${value}</span>`;
      this.statListEl.appendChild(item);
    });

    this.inventoryListEl.innerHTML = "";
    if (!this.engine.player.inventory.length) {
      const empty = document.createElement("li");
      empty.className = "stat-item";
      empty.textContent = "Пусто";
      this.inventoryListEl.appendChild(empty);
    } else {
      this.engine.player.inventory.forEach((itemName) => {
        const li = document.createElement("li");
        li.textContent = itemName;
        this.inventoryListEl.appendChild(li);
      });
    }
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

    this.bindEvents();
  }

  bindEvents() {
    this.showAdminBtn.addEventListener("click", () => {
      this.panel.classList.toggle("hidden");
    });

    this.toggleBtn.addEventListener("click", () => {
      this.panel.classList.add("hidden");
    });

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
      ToastManager.global().show("История сброшена к версии по умолчанию");
    });
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
