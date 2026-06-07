import MGMECommon from "../utils/mgme-common";
import MGMEChatJournal from "../utils/mgme-chat-journal";

const {DialogV2} = foundry.applications.api;
const {renderTemplate} = foundry.applications.handlebars;

export default class MGMEOracleBuilder {
  /** MACRO */
  static async mgmeOracleBuilder() {
    if (!game.tables.contents.length) {ui.notifications.warn(game.i18n.localize('MGME.WarnNoTables')); return}
    const builderDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-oraclebuilder-dialog.hbs', {})

    await DialogV2.wait({
      rejectClose: false,
      window: {title: game.i18n.localize('MGME.OracleBuilder')},
      content: builderDialog,
      render: function (event, dialog) {
        const root = dialog.element;
        const entriesOpen = 1; // Configurable???
        const lastOracle = game.user.getFlag('mythic-gme-tools', 'mgmeLastCustomOracle');
        if (lastOracle) {
          root.querySelector(`#mgme_question_target`).value = lastOracle.name;
          root.querySelector("#mgme_question_flavor").checked = lastOracle.askFlavor;
        }
        let i = 1;
        while (i <= 5) {
          const lastOracleLabel = lastOracle?.props[i-1]?.label ?? '';
          const lastOracleTable = lastOracle?.props[i-1]?.table ?? '';
          const lastOracleDraws = lastOracle?.props[i-1]?.draws ?? 1;
          let cls = (i <= entriesOpen || lastOracleLabel.length) ? '' : 'stat-hidden';
          root.querySelector("#mgme_builder_container").insertAdjacentHTML('beforeend',
            `
          <div id="entries_${i}" class="${cls}">
            <input id="mgme_builder_label_${i}" value="${lastOracleLabel}" style="margin-bottom:10px;width:110px;height:25px;" placeholder="Label #${i}"/>
            <select id="mgme_builder_table_${i}" class="mgme_builder_entries" style="width:205px;margin-bottom:10px;"><option value="None">None</option></select>
            <select id="mgme_builder_draws_${i}" style="width:40px;margin-bottom:10px;">
              <option value="1" ${lastOracleDraws === 1 ? 'selected' : ''}>1</option>
              <option value="2" ${lastOracleDraws === 2 ? 'selected' : ''}>2</option>
              <option value="3" ${lastOracleDraws === 3 ? 'selected' : ''}>3</option>
              <option value="4" ${lastOracleDraws === 4 ? 'selected' : ''}>4</option>
              <option value="5" ${lastOracleDraws === 5 ? 'selected' : ''}>5</option>
            </select>
            <i class="fas fa-minus-circle" style="color:darkred" onclick="clearEntry(${i})"></i>
          </div>
          `
          )
          const tableEntries = root.querySelector(`#mgme_builder_table_${i}`);
          const mythicTables = game.tables.contents.map(t => t.name);
          mythicTables.sort()
          mythicTables.forEach(t => tableEntries.insertAdjacentHTML('beforeend', `<option value="${t}" ${lastOracleTable === t ? 'selected' : ''}>${t}</option>`));
          i += 1;
        }
        root.querySelector("#mgme_question_target")?.focus();
      },
      buttons: [
        {
          action: 'test',
          icon: 'fas fa-comments',
          label: game.i18n.localize('MGME.TestOracle'),
          callback: (event, button) => {
            const oracle = MGMEOracleBuilder._mgmeOracleBuilderParse(button.form);
            if (oracle) {
              oracle.test = true;
              MGMEOracleBuilder.mgmePrepareCustomOracleQuestion(oracle);
            }
          }
        },
        {
          action: 'toMacro',
          icon: 'fas fa-save',
          label: game.i18n.localize('MGME.SaveOracle'),
          callback: (event, button) => {
            const oracle = MGMEOracleBuilder._mgmeOracleBuilderParse(button.form);
            if (oracle) {
              const command = `game.modules.get('mythic-gme-tools').api.mgmePrepareCustomOracleQuestion(${JSON.stringify(oracle)});`;
              Macro.create({name: oracle.name, type: 'script', command: command, img: 'icons/svg/cowled.svg'});
              ui.notifications.info(`${game.i18n.localize('MGME.OracleInfo')}: "${oracle.name}"`);
            }
          }
        }
      ],
      default: 'test'
    });
  }

  /** MACRO */
  static async mgmePrepareCustomOracleQuestion(oracle) {
    if (oracle.askFlavor) {
      const questionDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-customoracle-dialog.hbs', {})
      await DialogV2.wait({
      rejectClose: false,
        window: {title: oracle.name},
        content: questionDialog,
        render: (event, dialog) => dialog.element.querySelector("#mgme_custom_oracle_question")?.focus(),
        buttons: [
          {
            action: 'submit',
            icon: 'fas fa-comments',
            label: game.i18n.localize('MGME.ToChat'),
            callback: (event, button) => {
              let text = button.form.querySelector("#mgme_custom_oracle_question").value;
              MGMEOracleBuilder._mgmeGetCustomOracleAnswers(oracle, text)
            },
            default: true
          }
        ]
      });
    } else {
      MGMEOracleBuilder._mgmeGetCustomOracleAnswers(oracle)
    }
  }

  static _mgmeOracleBuilderParse(form) {
    const question = form.querySelector(`#mgme_question_target`).value?.trim();
    const questionFlavor = form.querySelector("#mgme_question_flavor").checked;
    if (!question)
      return;
    const oracle = {name: question, askFlavor: questionFlavor, props: []};
    let i = 0;
    while (i < 5) {
      i += 1;
      if (form.querySelector(`#entries_${i}`).classList.contains('stat-hidden'))
        continue
      const question_label = form.querySelector(`#mgme_builder_label_${i}`).value;
      const question_table = form.querySelector(`#mgme_builder_table_${i}`).value;
      if (!question_label.length || !question_table || question_table === 'None')
        continue;
      oracle.props.push({
        label: question_label,
        table: question_table,
        draws: parseInt(form.querySelector(`#mgme_builder_draws_${i}`).value)
      })
    }
    if (!oracle.props.length)
      return;
    game.user.setFlag('mythic-gme-tools', 'mgmeLastCustomOracle', oracle);
    return oracle
  }

  static async _mgmeGetCustomOracleAnswers(oracle, questionFlavor) {
    let content = questionFlavor?.length ? `<h2>${questionFlavor}</h2>` : '';
    for (const prop of oracle.props) {
      const descriptorTable = await MGMECommon._mgmeFindTableByName(prop.table);
      if (!descriptorTable)
        continue;
      const descriptorResults = await descriptorTable.drawMany(prop.draws, {displayChat: false});

      descriptorResults.results.forEach(result => {
        content += `<div><b>${prop.label}:</b> ${result.description}</div>`
      })
    }
    const whisper = MGMECommon._mgmeGetWhisperMode();
    let chatConfig = {
      flavor: oracle.name,
      content: content,
      speaker: ChatMessage.getSpeaker(),
      whisper: whisper
    };
    ChatMessage.create(chatConfig).then(async chat => {
      await ui.chat.scrollBottom({popout: true});
      if (!oracle.test) MGMEChatJournal._mgmeLogChatToJournal(chat);
    });
  }
}
