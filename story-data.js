const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const defaultStory = {
  metadata: {
    title: "Мистические истории",
    author: "Студия Nebula",
    version: "1.0.0",
    description:
      "Добро пожаловать в мир мистики и городских легенд. Каждое решение влияет на вашу судьбу и отношения с окружающими.",
  },
  stats: {
    мужество: 1,
    интуиция: 1,
    доверие: 1,
  },
  inventory: [],
  start: "prologue",
  nodes: {
    prologue: {
      id: "prologue",
      title: "Ночной звонок",
      text:
        "Поздним вечером вы получаете таинственное сообщение ВКонтакте от старого друга Артема. Он просит о помощи: в его общежитии произошло нечто странное, и он боится, что легенда о Тенях старой обсерватории оказалась правдой.",
      options: [
        {
          text: "Собраться и немедленно отправиться к обсерватории",
          next: "observatory_entrance",
          effects: { мужество: 1 },
        },
        {
          text: "Сначала позвонить Артему и узнать детали",
          next: "call_artem",
          effects: { доверие: 1 },
        },
      ],
    },
    call_artem: {
      id: "call_artem",
      title: "Разговор по телефону",
      text:
        "Артем шепотом рассказывает, что в старом крыле слышны шаги и перешептывания. Он просит вас взять его амулет удачи, лежащий в библиотеке, прежде чем прийти.",
      options: [
        {
          text: "Согласиться и взять амулет в библиотеке",
          next: "library",
          effects: { интуиция: 1 },
          inventory: ["+амулет удачи"],
        },
        {
          text: "Отказаться от амулета и ехать сразу",
          next: "observatory_entrance",
          effects: { мужество: 1, доверие: -1 },
        },
      ],
    },
    library: {
      id: "library",
      title: "Ночная библиотека",
      text:
        "Библиотека пуста. Амулет действительно лежит в шкафчике. Пока вы берете его, чувствуете странный холод и видите светящийся символ на полу.",
      options: [
        {
          text: "Осмотреть символ и попытаться понять его значение",
          next: "rune_vision",
          effects: { интуиция: 1 },
        },
        {
          text: "Игнорировать символ и поспешить к Артему",
          next: "observatory_entrance",
        },
      ],
    },
    rune_vision: {
      id: "rune_vision",
      title: "Видение",
      text:
        "Руна вспыхивает, и перед глазами появляется видение: фигура в плаще стоит у обсерватории и чертит круг из мела. Вы чувствуете прилив уверенности и узнаете фразу \"Отзовись, если слышишь\".",
      options: [
        {
          text: "Использовать фразу при следующей встрече",
          next: "observatory_entrance",
          effects: { мужество: 1, интуиция: 1 },
          flags: { phrase: true },
        },
      ],
    },
    observatory_entrance: {
      id: "observatory_entrance",
      title: "У обсерватории",
      text:
        "Старое здание возвышается над кампусом. Ветер усиливает шорохи, а двери приоткрыты. Артем встречает вас на пороге, дрожа от страха.",
      options: [
        {
          text: "Подбодрить Артема, показав амулет",
          next: "support_artem",
          requires: { inventory: ["амулет удачи"] },
          effects: { доверие: 1 },
        },
        {
          text: "Прислушаться к шорохам внутри",
          next: "whispers_hall",
          effects: { интуиция: 1 },
        },
        {
          text: "Войти внутрь, не раздумывая",
          next: "main_hall",
          effects: { мужество: 1 },
        },
      ],
    },
    support_artem: {
      id: "support_artem",
      title: "Вера",
      text:
        "Артем, увидев амулет, успокаивается и рассказывает больше. Он заметил силуэты и слышал, как кто-то повторяет \"Отзовись\" на разных голосах.",
      options: [
        {
          text: "Совместно войти в здание",
          next: "main_hall",
          effects: { доверие: 1 },
        },
        {
          text: "Остаться с Артемом, пока он не успокоится",
          next: "guarding_artem",
          effects: { мужество: -1, доверие: 1 },
        },
      ],
    },
    guarding_artem: {
      id: "guarding_artem",
      title: "Страж",
      text:
        "Вы решаете остаться с Артемом. В этот момент внутри обсерватории раздается громкий шорох. Кажется, вы упустили шанс застать незнакомца.",
      options: [
        {
          text: "Наконец зайти внутрь",
          next: "main_hall",
        },
      ],
    },
    whispers_hall: {
      id: "whispers_hall",
      title: "Шепчущий коридор",
      text:
        "Внутри темно, и шепот усиливается. Кажется, источником служит старый телескоп.",
      options: [
        {
          text: "Сказать фразу из видения",
          next: "echo_response",
          requires: { phrase: true },
          effects: { интуиция: 1 },
        },
        {
          text: "Осветить путь телефоном",
          next: "light_path",
          effects: { мужество: -1, интуиция: 1 },
        },
        {
          text: "Позвать Артема",
          next: "main_hall",
        },
      ],
    },
    main_hall: {
      id: "main_hall",
      title: "Главный зал",
      text:
        "В центре зала вы видите круг из мела. Внутри стоит девушка в плаще. Она поднимает голову, и её глаза сияют.",
      options: [
        {
          text: "Представиться и спросить, что происходит",
          next: "meet_adele",
          effects: { доверие: 1 },
        },
        {
          text: "Прервать ритуал, разметав круг",
          next: "break_circle",
          effects: { мужество: 1, доверие: -1 },
        },
      ],
    },
    meet_adele: {
      id: "meet_adele",
      title: "Адель",
      text:
        "Она представляется Адель и объясняет, что пытается установить связь с духом астронома, чтобы прекратить аномалии. Ей нужна помощь.",
      options: [
        {
          text: "Помочь Адель и встать в круг",
          next: "ritual_support",
          effects: { интуиция: 1, доверие: 1 },
        },
        {
          text: "Подозревать обман и подготовиться к бою",
          next: "prepare_fight",
          effects: { мужество: 1 },
        },
      ],
    },
    break_circle: {
      id: "break_circle",
      title: "Срыв ритуала",
      text:
        "Вы разрушаете круг, и помещение затягивает туман. Тени превращаются в силуэт, который набрасывается на вас.",
      options: [
        {
          text: "Бежать",
          next: "escape",
          effects: { мужество: -1 },
        },
        {
          text: "Противостоять, используя амулет",
          next: "amulet_defense",
          requires: { inventory: ["амулет удачи"] },
          effects: { мужество: 1 },
        },
      ],
    },
    ritual_support: {
      id: "ritual_support",
      title: "Связь установлена",
      text:
        "Совместно с Адель вы завершаете ритуал. Дух успокаивается и благодарит вас, обещая охранять кампус.",
      ending: {
        type: "good",
        summary: "Вы предотвратили всплеск паранормальной активности и обрели союзника в лице Адель.",
      },
    },
    prepare_fight: {
      id: "prepare_fight",
      title: "Выбор силы",
      text:
        "Вы сомневаетесь в намерениях Адель и готовитесь к схватке. Она вздыхает и исчезает, оставив вас наедине с вихрем Теней.",
      options: [
        {
          text: "Защититься амулетом",
          next: "amulet_defense",
          requires: { inventory: ["амулет удачи"] },
        },
        {
          text: "Использовать найденную фразу",
          next: "echo_response",
          requires: { phrase: true },
        },
        {
          text: "Просто атаковать",
          next: "fight_shadow",
          effects: { мужество: 1, доверие: -1 },
        },
      ],
    },
    echo_response: {
      id: "echo_response",
      title: "Отклик",
      text:
        "Вы произносите фразу \"Отзовись, если слышишь\". Тени замедляются и открывают путь, ведущий к звездной комнате.",
      options: [
        {
          text: "Следовать в комнату",
          next: "star_room",
        },
      ],
    },
    star_room: {
      id: "star_room",
      title: "Звездная комната",
      text:
        "Помещение наполнено светящимися кристаллами. Вы чувствуете спокойствие, а голос Адель благодарит вас.",
      ending: {
        type: "mystic",
        summary: "Вы раскрыли тайну шепотов и получили доступ к силе звездной комнаты.",
      },
    },
    amulet_defense: {
      id: "amulet_defense",
      title: "Щит света",
      text:
        "Амулет вспыхивает ярким светом, и Тени отступают. Артем восхищен вашей смелостью.",
      ending: {
        type: "heroic",
        summary: "Вы защитили друзей и доказали силу амулета удачи.",
      },
    },
    fight_shadow: {
      id: "fight_shadow",
      title: "Тень сильнее",
      text:
        "Вы бросаетесь в бой, но Тень оказывается сильнее. Вас отбрасывает к двери, и вы вынуждены отступить.",
      ending: {
        type: "bad",
        summary: "Легенда продолжает жить, а вы едва спасаетесь.",
      },
    },
    escape: {
      id: "escape",
      title: "Отступление",
      text:
        "Вы бегаете через коридоры, пока не оказываетесь на улице. Обсерватория остается позади, а шепот преследует вас.",
      ending: {
        type: "neutral",
        summary: "Вы избегаете опасности, но тайна обсерватории остается неразгаданной.",
      },
    },
  },
};

function loadStoryData() {
  const cached = localStorage.getItem("mysticStories.story");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.warn("Не удалось прочитать сохраненную историю", error);
    }
  }
  return clone(defaultStory);
}

function saveStoryData(data) {
  localStorage.setItem("mysticStories.story", JSON.stringify(data));
}

function resetStoryData() {
  saveStoryData(clone(defaultStory));
  return loadStoryData();
}
