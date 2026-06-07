import {DEFAULT_PANEL_KEYS, normalizePanelKeys, PANEL_DEFINITIONS} from "./panel-registry";
import '../style/panel-mythic.css';
import '../style/panel-pum-v8.css';

const {ApplicationV2, DialogV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {renderTemplate} = foundry.applications.handlebars;

export default class MGMEPanel extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "mgme_oracle_panel_window",
    window: {
      title: "Mythic GME Tools",
      resizable: true,
      controls: [
        {
          icon: "fas fa-book-open",
          label: "MGME.Export",
          action: "exportChat"
        },
        {
          icon: "fas fa-cog",
          label: "MGME.PanelConfigureLabel",
          action: "configureTabs"
        }
      ]
    },
    position: {
      width: 520,
      height: 420
    },
    actions: {
      exportChat: MGMEPanel._onExportChat,
      configureTabs: MGMEPanel._onConfigureTabs
    }
  };

  static PARTS = {
    main: {
      template: "./modules/mythic-gme-tools/template/panel-oracles.hbs"
    }
  };

  constructor(panelKeys, options={}) {
    super(options);
    this.panelKeys = normalizePanelKeys(panelKeys ?? game.settings.get('mythic-gme-tools', 'panelKeys'));
    this.activePanelKey = this.panelKeys[0] ?? DEFAULT_PANEL_KEYS[0];
  }

  static async _onExportChat() {
    const api = game.modules.get('mythic-gme-tools').api;
    api.mgmeExportChatToJournal();
  }

  static async _onConfigureTabs() {
    this._configurePanel();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const panels = [];
    for (const key of this.panelKeys) {
      const definition = PANEL_DEFINITIONS[key];
      if (!definition) continue;
      const data = definition.getData ? definition.getData() : {};
      panels.push({
        id: key,
        label: definition.label,
        active: key === this.activePanelKey,
        content: await renderTemplate(definition.template, data)
      });
    }
    return foundry.utils.mergeObject(context, {
      hasPanels: panels.length > 0,
      panels: panels
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const api = game.modules.get('mythic-gme-tools').api;
    this.element.querySelectorAll(".mgme-tab-link").forEach(tab => {
      tab.addEventListener('click', event => {
        event.preventDefault();
        this._activateTab(event.currentTarget.dataset.tab);
      });
    });
    for (const key of this.panelKeys) {
      const panel = this.element.querySelector(`.mgme-oracle-tab[data-tab="${key}"]`);
      PANEL_DEFINITIONS[key]?.bind(panel, api);
    }
  }

  _activateTab(panelKey) {
    if (!PANEL_DEFINITIONS[panelKey]) return;
    this.activePanelKey = panelKey;
    this.element.querySelectorAll(".mgme-tab-link").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === panelKey);
    });
    this.element.querySelectorAll(".mgme-oracle-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === panelKey);
      tab.hidden = tab.dataset.tab !== panelKey;
    });
  }

  _panelPosition(panelKey) {
    const definition = PANEL_DEFINITIONS[panelKey];
    if (!definition) return {};
    return {
      width: definition.width,
      height: definition.height
    };
  }

  async _configurePanel() {
    const selectedKeys = new Set(this.panelKeys);
    const content = `
      <form>
        <div class="mgme-configure-tabs">
          ${Object.values(PANEL_DEFINITIONS).map(panel => `
            <label class="mgme-configure-tabs__choice">
              <input type="checkbox" name="panelKeys" value="${panel.id}" ${selectedKeys.has(panel.id) ? 'checked' : ''}/>
              <span>${panel.label}</span>
            </label>
          `).join('')}
        </div>
        <div style="text-align:right;margin-bottom:5px;margin-top:5px;font-size:11px">
          <a href="https://ko-fi.com/jeansenvaars">Consider a donation</a> if you like this module :)
        </div>
      </form>
    `;

    await DialogV2.wait({
      rejectClose: false,
      window: {title: 'Configure Mythic GME Tools Panel'},
      content: content,
      buttons: [
        {
          action: 'submit',
          icon: 'fas fa-check',
          label: game.i18n.localize('MGME.PanelConfigureSubmit'),
          callback: async (event, button) => {
            const form = button.form;
            const panelKeys = Array.from(form.querySelectorAll('input[name="panelKeys"]:checked')).map(input => input.value);
            if (!panelKeys.length) {
              ui.notifications.warn("Select at least one Mythic GME Tools tab.");
              return false;
            }
            await game.settings.set('mythic-gme-tools', 'panelKeys', panelKeys);
          },
          default: true
        }
      ]
    });
  }

}
